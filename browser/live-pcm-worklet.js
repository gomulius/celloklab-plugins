/* Shared host transport: mono S16LE 24 kHz, no credentials or persistence. */
'use strict';
class CelloklabPCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.step = sampleRate / 24000;
        this.inputIndex = -1;
        this.outputIndex = 0;
        this.previous = 0;
        // Pause-aware utterances, not fixed two-second cuts through words.
        // 1.5 s minimum + 400 ms near-digital silence; hard cap matches host 5 s.
        this.maxSamples = 120000;
        this.minSamples = 36000;
        this.pauseSamples = 9600;
        this.prefixSamples = 4800; // Keep 200 ms before onset, never overlap packets.
        this.bytes = new ArrayBuffer(this.maxSamples * 2);
        this.view = new DataView(this.bytes);
        this.count = 0;
        this.hasSignal = false;
        this.silentSamples = 0;
        this.capturing = true;
        // Aggregate real mono input, never send samples to the visual UI.
        this.meterWindow = Math.max(1, Math.round(sampleRate / 12));
        this.meterCount = 0;
        this.meterSquares = 0;
        this.meterPeak = 0;
        this.port.onmessage = event => {
            if (event.data?.type === 'flush') {
                this.capturing = false;
                this.meterCount = this.meterSquares = this.meterPeak = 0;
                this.emit(event.data.final === true);
                this.port.postMessage({type: 'flushed'});
            }
        };
    }
    emit(final = false) {
        // Only exact/near-digital silence is omitted. Quiet speech is retained;
        // this is deliberately not an amplitude-based speech/noise classifier.
        if (this.count && this.hasSignal) {
            const packet = this.bytes.slice(0, this.count * 2);
            this.port.postMessage({type: 'pcm', bytes: packet, final}, [packet]);
        }
        this.count = 0;
        this.hasSignal = false;
        this.silentSamples = 0;
    }
    append(value) {
        const bounded = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
        const sample = Math.round(bounded * (bounded < 0 ? 32768 : 32767));
        this.view.setInt16(this.count * 2, sample, true);
        this.count++;
        if (Math.abs(sample) > 8) {
            this.hasSignal = true;
            this.silentSamples = 0;
        } else this.silentSamples++;
        if (!this.hasSignal && this.count >= this.prefixSamples * 2) {
            // Bound idle memory while retaining the most recent onset padding.
            new Uint8Array(this.bytes).copyWithin(0, (this.count - this.prefixSamples) * 2, this.count * 2);
            this.count = this.prefixSamples;
        }
        if (this.count === this.maxSamples ||
            (this.hasSignal && this.count >= this.minSamples && this.silentSamples >= this.pauseSamples)) this.emit();
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
            const level = Number.isFinite(current) ? Math.max(-1, Math.min(1, current)) : 0;
            this.meterSquares += level * level;
            this.meterPeak = Math.max(this.meterPeak, Math.abs(level));
            if (++this.meterCount === this.meterWindow) {
                this.port.postMessage({type: 'level', rms: Math.sqrt(this.meterSquares / this.meterCount), peak: this.meterPeak});
                this.meterCount = this.meterSquares = this.meterPeak = 0;
            }
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
