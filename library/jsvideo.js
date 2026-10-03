(() => {
  'use strict';

  const _state = Symbol('jsVideoState');

  class JSVideo extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });

      this[_state] = {
        isSeeking: false,
        rafPending: false,
        targetTime: 0,
        isRendered: false,
        hideControlsTimeout: null
      };
    }

    static get observedAttributes() {
      return ['src', 'poster', 'muted', 'loop', 'accent', 'volume', 'autohide', 'keyboard'];
    }

    connectedCallback() {
      if (!this[_state].isRendered) {
        this.render();
        this.setupElements();
        this.setupEvents();
        this.syncInitialAttributes();
        this[_state].isRendered = true;
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this.video) return;

      if (name === 'src') this.video.src = newValue || '';
      if (name === 'poster') this.video.poster = newValue || '';
      if (name === 'muted') this.updateMuteState(this.hasAttribute('muted'));
      if (name === 'loop') this.video.loop = this.hasAttribute('loop');
      if (name === 'volume') this.setVolume(parseFloat(newValue));
      if (name === 'accent') {
        this.container.style.setProperty('--accent-color', newValue || '#ff3e3e');
      }
    }

    syncInitialAttributes() {
      if (this.hasAttribute('src')) this.video.src = this.getAttribute('src');
      if (this.hasAttribute('poster')) this.video.poster = this.getAttribute('poster');
      
      const vol = this.getAttribute('volume');
      if (vol !== null) this.setVolume(parseFloat(vol));
      
      this.video.muted = this.hasAttribute('muted');
      this.video.loop = this.hasAttribute('loop');
      if (this.hasAttribute('autoplay')) this.video.autoplay = true;

      this.updateVolumeUI();
    }

    render() {
      const accent = this.getAttribute('accent') || '#ff3e3e';

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: inline-block;
            width: 100%;
            max-width: 900px;
            font-family: system-ui, -apple-system, sans-serif;
            user-select: none;
            outline: none;
          }

          .player-container {
            position: relative;
            width: 100%;
            background: #000;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            aspect-ratio: 16 / 9;
            display: flex;
            align-items: center;
            justify-content: center;
            --accent-color: ${accent};
            cursor: pointer;
          }

          .player-container.user-idle {
            cursor: none;
          }

          video {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .big-play {
            position: absolute;
            width: 68px;
            height: 68px;
            background: var(--accent-color);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            z-index: 2;
          }

          .big-play:hover {
            transform: scale(1.1);
          }

          .big-play svg {
            fill: #fff;
            width: 28px;
            height: 28px;
            margin-left: 4px;
          }

          .player-container.playing .big-play {
            opacity: 0;
            pointer-events: none;
          }

          .controls {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.9));
            padding: 12px 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 3;
            cursor: default;
          }

          .player-container:hover .controls,
          .player-container:focus-within .controls,
          .player-container.show-controls .controls {
            opacity: 1;
          }

          .player-container.user-idle.playing .controls {
            opacity: 0 !important;
          }

          .progress-wrapper {
            position: relative;
            height: 8px;
            background: rgba(255,255,255,0.25);
            border-radius: 4px;
            cursor: pointer;
            touch-action: none;
            display: flex;
            align-items: center;
          }

          .progress-bar {
            height: 100%;
            width: 0%;
            background: var(--accent-color);
            border-radius: 4px;
            pointer-events: none;
            will-change: width;
            position: relative;
          }

          .time-tooltip {
            position: absolute;
            bottom: 16px;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 11px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s ease;
            white-space: nowrap;
          }

          .progress-wrapper:hover .time-tooltip {
            opacity: 1;
          }

          .control-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #fff;
          }

          .left-controls, .right-controls {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .volume-container {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .volume-slider {
            width: 0px;
            opacity: 0;
            transition: width 0.2s ease, opacity 0.2s ease;
            accent-color: var(--accent-color);
            cursor: pointer;
          }

          .volume-container:hover .volume-slider,
          .volume-slider:focus {
            width: 60px;
            opacity: 1;
          }

          button {
            background: none;
            border: none;
            color: #fff;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.85;
            transition: opacity 0.2s ease, transform 0.1s ease;
          }

          button:hover {
            opacity: 1;
            transform: scale(1.08);
          }

          button svg {
            width: 20px;
            height: 20px;
            fill: currentColor;
          }

          .time {
            font-size: 13px;
            font-weight: 500;
            font-variant-numeric: tabular-nums;
            opacity: 0.9;
          }

          select {
            background: rgba(255,255,255,0.15);
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 12px;
            cursor: pointer;
            outline: none;
          }

          select option {
            background: #111;
            color: #fff;
          }
        </style>

        <div class="player-container" tabindex="0">
          <video preload="metadata" playsinline></video>

          <div class="big-play">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>

          <div class="controls">
            <div class="progress-wrapper">
              <div class="time-tooltip">0:00</div>
              <div class="progress-bar"></div>
            </div>
            <div class="control-row">
              <div class="left-controls">
                <button class="play-btn" aria-label="Play">
                  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>

                <div class="volume-container">
                  <button class="mute-btn" aria-label="Mute">
                    <svg class="icon-vol-high" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                  </button>
                  <input type="range" class="volume-slider" min="0" max="1" step="0.05" value="1">
                </div>

                <span class="time">0:00 / 0:00</span>
              </div>

              <div class="right-controls">
                <select class="speed-select" aria-label="Playback Speed">
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1" selected>1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
                <button class="pip-btn" title="Picture in Picture">
                  <svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4-8H1c-.55 0-1 .45-1 1v16c0 .55.45 1 1 1h22c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zm-2 16H3V5h18v14z"/></svg>
                </button>
                <button class="fullscreen-btn" title="Fullscreen">
                  <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    setupElements() {
      const root = this.shadowRoot;
      this.container = root.querySelector('.player-container');
      this.video = root.querySelector('video');
      this.bigPlay = root.querySelector('.big-play');
      this.playBtn = root.querySelector('.play-btn');
      this.muteBtn = root.querySelector('.mute-btn');
      this.volumeSlider = root.querySelector('.volume-slider');
      this.progressBar = root.querySelector('.progress-bar');
      this.progressWrapper = root.querySelector('.progress-wrapper');
      this.timeTooltip = root.querySelector('.time-tooltip');
      this.timeDisplay = root.querySelector('.time');
      this.speedSelect = root.querySelector('.speed-select');
      this.pipBtn = root.querySelector('.pip-btn');
      this.fullscreenBtn = root.querySelector('.fullscreen-btn');
    }

    setupEvents() {
      const state = this[_state];

      const togglePlay = () => {
        if (this.video.paused) {
          this.video.play().catch(() => {});
        } else {
          this.video.pause();
        }
      };

      this.bigPlay.addEventListener('click', togglePlay);
      this.playBtn.addEventListener('click', togglePlay);
      this.video.addEventListener('click', togglePlay);

      // Mouse Idle / Auto-hide Controls
      const resetIdleTimer = () => {
        if (this.getAttribute('autohide') === 'false') return;
        
        this.container.classList.remove('user-idle');
        clearTimeout(state.hideControlsTimeout);

        if (!this.video.paused) {
          state.hideControlsTimeout = setTimeout(() => {
            this.container.classList.add('user-idle');
          }, 2500);
        }
      };

      this.container.addEventListener('mousemove', resetIdleTimer);
      this.container.addEventListener('mouseleave', () => {
        if (!this.video.paused && this.getAttribute('autohide') !== 'false') {
          this.container.classList.add('user-idle');
        }
      });

      // Play State Changes
      this.video.addEventListener('play', () => {
        this.container.classList.add('playing');
        this.playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        resetIdleTimer();
      });

      this.video.addEventListener('pause', () => {
        this.container.classList.remove('playing');
        this.container.classList.remove('user-idle');
        this.playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        clearTimeout(state.hideControlsTimeout);
      });

      this.video.addEventListener('loadedmetadata', () => {
        this.updateProgress();
      });

      this.video.addEventListener('timeupdate', () => {
        if (!state.isSeeking && !state.rafPending) {
          state.rafPending = true;
          requestAnimationFrame(() => {
            this.updateProgress();
            state.rafPending = false;
          });
        }
      });

      // Seek & Tooltip Hover
      const handleSeek = (e) => {
        if (!this.video.duration) return;
        const rect = this.progressWrapper.getBoundingClientRect();
        const posX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const pct = posX / rect.width;

        state.targetTime = pct * this.video.duration;
        this.progressBar.style.width = `${pct * 100}%`;
        this.timeDisplay.textContent = `${this.formatTime(state.targetTime)} / ${this.formatTime(this.video.duration)}`;
      };

      this.progressWrapper.addEventListener('pointerdown', (e) => {
        state.isSeeking = true;
        this.progressWrapper.setPointerCapture(e.pointerId);
        handleSeek(e);
      });

      this.progressWrapper.addEventListener('pointermove', (e) => {
        if (state.isSeeking) {
          handleSeek(e);
        }
        
        // Tooltip Hover position
        if (this.video.duration) {
          const rect = this.progressWrapper.getBoundingClientRect();
          const posX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
          const hoverTime = (posX / rect.width) * this.video.duration;
          this.timeTooltip.style.left = `${posX}px`;
          this.timeTooltip.textContent = this.formatTime(hoverTime);
        }
      });

      const stopSeek = (e) => {
        if (state.isSeeking) {
          state.isSeeking = false;
          this.video.currentTime = state.targetTime;
          try {
            this.progressWrapper.releasePointerCapture(e.pointerId);
          } catch (_) {}
        }
      };

      this.progressWrapper.addEventListener('pointerup', stopSeek);
      this.progressWrapper.addEventListener('pointercancel', stopSeek);

      // Volume Controls
      this.muteBtn.addEventListener('click', () => {
        this.updateMuteState(!this.video.muted);
      });

      this.volumeSlider.addEventListener('input', (e) => {
        this.setVolume(parseFloat(e.target.value));
      });

      // Playback Rate
      this.speedSelect.addEventListener('change', (e) => {
        this.video.playbackRate = parseFloat(e.target.value);
      });

      // PIP & Fullscreen
      this.pipBtn.addEventListener('click', async () => {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else if (document.pictureInPictureEnabled) {
            await this.video.requestPictureInPicture();
          }
        } catch (_) {}
      });

      this.fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          this.container.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });

      // Keyboard Shortcuts
      this.container.addEventListener('keydown', (e) => {
        if (this.getAttribute('keyboard') === 'false') return;

        switch (e.key.toLowerCase()) {
          case ' ':
          case 'k':
            e.preventDefault();
            togglePlay();
            break;
          case 'f':
            e.preventDefault();
            this.fullscreenBtn.click();
            break;
          case 'm':
            e.preventDefault();
            this.muteBtn.click();
            break;
          case 'arrowleft':
            e.preventDefault();
            this.video.currentTime = Math.max(0, this.video.currentTime - 5);
            break;
          case 'arrowright':
            e.preventDefault();
            this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 5);
            break;
          case 'arrowup':
            e.preventDefault();
            this.setVolume(Math.min(1, this.video.volume + 0.1));
            break;
          case 'arrowdown':
            e.preventDefault();
            this.setVolume(Math.max(0, this.video.volume - 0.1));
            break;
        }
      });
    }

    setVolume(val) {
      if (isNaN(val)) return;
      this.video.volume = Math.max(0, Math.min(1, val));
      this.video.muted = this.video.volume === 0;
      this.updateVolumeUI();
    }

    updateMuteState(muted) {
      this.video.muted = muted;
      this.updateVolumeUI();
    }

    updateVolumeUI() {
      if (!this.volumeSlider) return;
      const isMuted = this.video.muted || this.video.volume === 0;
      this.volumeSlider.value = isMuted ? 0 : this.video.volume;
      
      let icon = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
      
      if (isMuted) {
        icon = '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
      } else if (this.video.volume < 0.5) {
        icon = '<svg viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>';
      }

      this.muteBtn.innerHTML = icon;
    }

    updateProgress() {
      if (!this.video.duration) return;
      const pct = (this.video.currentTime / this.video.duration) * 100;
      this.progressBar.style.width = `${pct}%`;
      this.timeDisplay.textContent = `${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}`;
    }

    formatTime(seconds) {
      if (isNaN(seconds)) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
  }

  if (!customElements.get('js-video')) {
    customElements.define('js-video', JSVideo);
  }
})();
