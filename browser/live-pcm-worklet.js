/* Shared host transport: mono S16LE 24 kHz, no credentials or persistence. */
'use strict';
class CelloklabPCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.step = sampleRate / 24000;
        this.inputIndex = -1;
        this.outputIndex = 0;
        this.previous = 0;
        this.bytes = new ArrayBuffer(48000 * 2); // Two seconds, never overlapping.
        this.view = new DataView(this.bytes);
        this.count = 0;
        this.capturing = true;
        this.port.onmessage = event => {
            if (event.data?.type === 'flush') {
                this.capturing = false;
                this.emit(event.data.final === true);
                this.port.postMessage({type: 'flushed'});
            }
        };
    }
    emit(final = false) {
        if (!this.count) return;
        const packet = this.bytes.slice(0, this.count * 2);
        this.port.postMessage({type: 'pcm', bytes: packet, final}, [packet]);
        this.count = 0;
    }
    append(value) {
        const bounded = Math.max(-1, Math.min(1, value));
        this.view.setInt16(this.count * 2, Math.round(bounded * (bounded < 0 ? 32768 : 32767)), true);
        if (++this.count === 48000) this.emit();
    }
    process(inputs, outputs) {
        // Explicitly mute all output; microphone must never play through speakers.
        for (const output of outputs) for (const channel of output) channel.fill(0);
        if (!this.capturing) return true;
        const channels = inputs[0];
        if (!channels?.length) return true;
        for (let i = 0; i < channels[0].length; i++) {
            let current = 0;
            for (const channel of channels) current += channel[i] / channels.length;
            this.inputIndex++;
            // Absolute output positions avoid block-boundary rounding/drift at
            // 44.1 kHz and preserve the previous sample for interpolation.
            let position = this.outputIndex * this.step;
            while (position <= this.inputIndex) {
                const fraction = position - (this.inputIndex - 1);
                this.append(this.inputIndex === 0 ? current : this.previous + (current - this.previous) * fraction);
                position = (++this.outputIndex) * this.step;
            }
            this.previous = current;
        }
        return true;
    }
}
registerProcessor('celloklab-live-pcm', CelloklabPCMProcessor);
