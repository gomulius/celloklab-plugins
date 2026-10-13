/* Shared host transport: mono S16LE 24 kHz, no credentials or persistence. */
'use strict';
class CelloklabPCMProcessor extends AudioWorkletProcessor {
    constructor(options = {}) {
        super();
        this.captureLimit = Number.isInteger(options.processorOptions?.captureLimitSamples) ?
            Math.max(0, options.processorOptions.captureLimitSamples) : Infinity;
        this.step = sampleRate / 24000;
        this.inputIndex = -1;
        this.outputIndex = 0;
        this.previous = 0;
        // Energy VAD selects boundaries only: uncertain/quiet speech is retained.
        this.maxSamples = 120000;
        this.minSamples = 36000;
        this.pauseSamples = 9600;
        this.prefixSamples = 4800;
        this.bytes = new ArrayBuffer(this.maxSamples * 2);
        this.view = new DataView(this.bytes);
        this.count = 0;
        this.hasSignal = false;
        this.silentSamples = 0;
        this.windowSamples = 480; // 20 ms, independent of input rate/block size.
        this.energyCount = this.energySquares = 0;
        this.noiseFloor = 0.001;
        this.speechEnergy = this.quietSamples = 0;
        this.packetStart = this.lastEnd = this.nextContextSamples = 0;
        this.contextSamples = 4800;
        this.capturing = true;
        this.meterWindow = Math.max(1, Math.round(sampleRate / 12));
        this.meterCount = this.meterSquares = this.meterPeak = 0;
        this.port.onmessage = event => {
            if (event.data?.type === 'flush') {
                this.capturing = false;
                this.meterCount = this.meterSquares = this.meterPeak = 0;
                this.emit(event.data.final === true, 'flush');
                this.port.postMessage({type: 'flushed'});
            }
        };
    }
    emit(final = false, boundary = 'pause') {
        // Only near-digital idle silence is omitted. Even low-energy background
        // remains PCM: energy classification cannot safely distinguish whispers.
        if (this.count && this.hasSignal) {
            const packet = this.bytes.slice(0, this.count * 2);
            const end = this.packetStart + this.count;
            // Describe potential context without duplicating opaque audio. A future
            // negotiated backend must separate overlap from new evidence/duration.
            this.port.postMessage({type: 'pcm', bytes: packet, final,
                capture: {startSample: this.packetStart, endSample: end,
                    newSamples: this.count, overlapSamples: 0,
                    contextBeforeSamples: this.packetStart === this.lastEnd ? this.nextContextSamples : 0,
                    boundary}}, [packet]);
            this.lastEnd = end;
            this.nextContextSamples = boundary === 'cap' ? this.contextSamples : 0;
        }
        this.count = 0;
        this.hasSignal = false;
        this.silentSamples = this.quietSamples = this.speechEnergy = 0;
    }
    append(value) {
        const bounded = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
        const sample = Math.round(bounded * (bounded < 0 ? 32768 : 32767));
        if (!this.count) this.packetStart = this.outputIndex;
        this.view.setInt16(this.count * 2, sample, true);
        this.count++;
        this.energySquares += bounded * bounded;
        if (++this.energyCount === this.windowSamples) {
            const energy = Math.sqrt(this.energySquares / this.energyCount);
            // Fast falling/slow rising floor, bounded so a voice is not learned
            // as background. Relative hysteresis retains soft continuations.
            const alpha = energy < this.noiseFloor ? 0.2 : 0.005;
            this.noiseFloor += alpha * (Math.min(energy, 0.01) - this.noiseFloor);
            const threshold = Math.max(0.00015, Math.min(0.018, this.noiseFloor * 1.8));
            const pauseThreshold = Math.max(threshold, Math.min(0.02, this.speechEnergy * 0.2));
            const quiet = energy < pauseThreshold && (!this.speechEnergy || energy < this.speechEnergy * 0.45);
            this.quietSamples = quiet ? this.quietSamples + this.windowSamples : 0;
            if (!quiet) this.speechEnergy = Math.max(energy, this.speechEnergy * 0.98);
            this.energyCount = this.energySquares = 0;
        }
        if (Math.abs(sample) > 8) {
            this.hasSignal = true;
            this.silentSamples = 0;
        } else this.silentSamples++;
        if (!this.hasSignal && this.count >= this.prefixSamples * 2) {
            new Uint8Array(this.bytes).copyWithin(0, (this.count - this.prefixSamples) * 2, this.count * 2);
            this.count = this.prefixSamples;
            this.packetStart = this.outputIndex + 1 - this.count;
        }
        if (this.count === this.maxSamples || (this.hasSignal && this.count >= this.minSamples &&
            (this.silentSamples >= this.pauseSamples || this.quietSamples >= this.pauseSamples))) {
            this.emit(false, this.count === this.maxSamples ? 'cap' : 'pause');
        }
    }
    process(inputs, outputs) {
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
            // Absolute positions preserve interpolation across blocks at 44.1 kHz.
            let position = this.outputIndex * this.step;
            while (position <= this.inputIndex) {
                if (this.outputIndex >= this.captureLimit) {
                    this.capturing = false;
                    this.emit(true, 'limit');
                    this.port.postMessage({type: 'limit'});
                    return true;
                }
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
