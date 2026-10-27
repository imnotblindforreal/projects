/**
 * TypeWriter API
 * A flexible, promise-based typing animation engine for the web.
 */
class TypeWriter {
    /**
     * @param {HTMLElement|string} target - DOM Element or Selector
     * @param {Object} [options] - Configuration options
     * @param {number} [options.lineDelay=750] - Delay after each line in ms
     * @param {boolean} [options.loop=false] - Loop through lines continuously
     * @param {boolean} [options.onlyIfVisible=true] - Only run/type when element is in viewport
     * @param {Function} [options.onChar] - Callback when a char is typed
     * @param {Function} [options.onLineComplete] - Callback when a line finishes
     * @param {Function} [options.onComplete] - Callback when all lines finish
     */
    constructor(target, options = {}) {
        this.element = typeof target === 'string' ? document.querySelector(target) : target;
        if (!this.element) {
            throw new Error('[TypeWriter] Target element not found.');
        }

        this.options = {
            lineDelay: 750,
            loop: false,
            onlyIfVisible: true, // Default: auto-pause when scrolled off screen
            onChar: () => {},
            onLineComplete: () => {},
            onComplete: () => {},
            ...options
        };

        this.lines = [];
        this.isTyping = false;
        this.isPaused = false;
        this.isVisible = true;
        this.currentFrameId = null;
        this.resolveCurrentState = null;
        this.observer = null;

        if (this.options.onlyIfVisible) {
            this._setupVisibilityObserver();
        }
    }

    /**
     * Sets up IntersectionObserver to track viewport visibility
     * @private
     */
    _setupVisibilityObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                this.isVisible = entry.isIntersecting;

                // Auto pause if scrolled out of view, resume when back in view
                if (!this.isVisible && this.isTyping && !this.isPaused) {
                    this.pause();
                    this._wasAutoPaused = true;
                } else if (this.isVisible && this._wasAutoPaused) {
                    this._wasAutoPaused = false;
                    this.resume();
                }
            });
        }, { threshold: 0.1 }); // Triggers when at least 10% is visible

        this.observer.observe(this.element);
    }

    /**
     * Queue or replace sequence lines
     * @param {Array<[string, number]>} lines - Array of tuple: [text, durationInSeconds]
     * @returns {TypeWriter}
     */
    setLines(lines) {
        this.lines = Array.isArray(lines) ? lines : [];
        return this;
    }

    /**
     * Start or restart typing animation sequence
     * @returns {Promise<void>}
     */
    async start() {
        if (!this.lines.length) {
            console.warn('[TypeWriter] No lines provided to type.');
            return;
        }

        this.stop();
        this.isTyping = true;
        this.element.textContent = '';

        do {
            for (let i = 0; i < this.lines.length; i++) {
                if (!this.isTyping) break;

                const [text, durationSec] = this.lines[i];
                const durationMs = durationSec * 1000;

                await this._typeLine(text, durationMs, i);

                if (!this.isTyping) break;

                this.options.onLineComplete({ text, index: i });

                if (i < this.lines.length - 1) {
                    this.element.textContent += '\n';
                    await this._sleep(this.options.lineDelay);
                }
            }

            if (this.options.loop && this.isTyping) {
                await this._sleep(this.options.lineDelay);
                this.element.textContent = '';
            }
        } while (this.options.loop && this.isTyping);

        if (this.isTyping) {
            this.isTyping = false;
            this.options.onComplete();
        }
    }

    /**
     * Pause typing execution
     */
    pause() {
        this.isPaused = true;
    }

    /**
     * Resume typing execution
     */
    resume() {
        if (this.isPaused && this.resolveCurrentState) {
            this.isPaused = false;
            const resolve = this.resolveCurrentState;
            this.resolveCurrentState = null;
            resolve();
        }
    }

    /**
     * Stop and cleanup
     */
    stop() {
        this.isTyping = false;
        this.isPaused = false;
        this._wasAutoPaused = false;
        if (this.currentFrameId) {
            cancelAnimationFrame(this.currentFrameId);
        }
        if (this.resolveCurrentState) {
            this.resolveCurrentState();
        }
    }

    /**
     * Helper: Types out a single line using frame-based timeline
     * @private
     */
    _typeLine(text, durationMs, lineIndex) {
        return new Promise((resolve) => {
            const startTime = performance.now();
            const baseText = this.element.textContent;
            let lastCharIndex = -1;

            const frame = async (currentTime) => {
                if (!this.isTyping) {
                    resolve();
                    return;
                }

                // Pause loop when paused manually or scrolled offscreen
                if (this.isPaused || (this.options.onlyIfVisible && !this.isVisible)) {
                    await new Promise(r => { this.resolveCurrentState = r; });
                }

                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / durationMs, 1);
                const charIndex = Math.floor(progress * text.length);

                if (charIndex !== lastCharIndex) {
                    lastCharIndex = charIndex;
                    this.options.onChar({
                        char: text[charIndex - 1] || '',
                        charIndex,
                        lineIndex
                    });
                }

                this.element.textContent = baseText + text.substring(0, charIndex);

                if (progress < 1) {
                    this.currentFrameId = requestAnimationFrame(frame);
                } else {
                    this.element.textContent = baseText + text;
                    resolve();
                }
            };

            this.currentFrameId = requestAnimationFrame(frame);
        });
    }

    /**
     * Helper: Sleep timer that respects visibility pauses
     * @private
     */
    _sleep(ms) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = async () => {
                if (!this.isTyping) return resolve();
                if (this.isPaused || (this.options.onlyIfVisible && !this.isVisible)) {
                    await new Promise(r => { this.resolveCurrentState = r; });
                }
                if (Date.now() - start >= ms) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }
}
