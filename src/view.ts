export const GAME_MARKUP = `
<div id="game" data-phase="intro">
  <div class="letterbox-side left-side"></div><div class="letterbox-side right-side"></div>
  <main id="device">
    <canvas id="world" aria-label="Haunted classroom camera view"></canvas>
    <div class="vignette"></div><div class="grain"></div><div class="scanlines"></div>
    <div id="iris-overlay" aria-hidden="true">
      <svg id="iris" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="blade-metal" x1="0%" y1="0%" x2="90%" y2="90%"><stop offset="0" stop-color="#171d22"/><stop offset=".48" stop-color="#28313a"/><stop offset=".85" stop-color="#0c141a"/><stop offset="1" stop-color="#060b0e"/></linearGradient></defs>
        <g id="blades"></g>
      </svg>
    </div>
    <div class="cam-border" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="hud" id="hud">
      <div class="hud-top">
        <div><span class="hud-kicker">SUBJECT</span><span id="act-num" class="hud-act">01 <span>/ 03</span></span></div>
        <div class="film-progress" id="film-progress" aria-label="Collected photographs"><span></span><span></span><span></span></div>
        <button class="tiny-button" id="sound" aria-label="Toggle sound">♫</button>
      </div>
      <div class="reticle" id="reticle"><span></span><span></span><span></span><span></span><div class="reticle-dot"></div></div>
      <div class="clue" id="clue"><span class="clue-line"></span><span id="clue-label">SOMETHING MOVED...</span></div>
      <div class="signal-display" id="signal-display"><span class="signal-icon">◈</span><span id="signal-label">SPECTRAL SIGNAL</span><div class="signal-track"><div id="signal-fill"></div></div></div>
      <div class="capture-controls">
        <div class="controls-info"><span class="mono-label">EXPOSURE</span><strong id="exposure-value">0.00<span>s</span></strong></div>
        <button id="shutter" type="button" aria-label="Hold to expose and release to capture">
          <span class="shutter-ring"><span class="shutter-core"><svg viewBox="0 0 48 48"><path d="M20 7 L31 7 L39 16 L43 27 L37 37 L28 42 L16 39 L8 30 L7 20 L14 10 Z M20 7 L26 22 M39 16 L26 22 M43 27 L26 22 M37 37 L26 22 M28 42 L26 22 M16 39 L26 22 M8 30 L26 22 M7 20 L26 22 M14 10 L26 22" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span></span>
        </button>
        <button id="album-button" class="album-button" aria-label="View captured photos"><span>▣</span><small>ALBUM</small></button>
      </div>
      <div class="hint" id="hint">HOLD TO EXPOSE</div>
      <div class="bottom-line">PARANORMAL CAMERA SYSTEM // 1987</div>
    </div>
    <section class="screen intro-screen" id="intro">
      <div class="intro-top"><span>FILE NO. 001</span><span>OCT. 30, 1987</span></div>
      <div class="intro-center"><div class="small-cross">✛</div><p>THE CAMERA REVEALS<br/>WHAT THE EYE CANNOT.</p><h1>LONG<br/><em>EXPOSURE</em></h1><div class="title-rule"></div><h2>GHOST HUNT</h2></div>
      <div class="intro-bottom"><p>ROOM 3-2 / SEALED 1987<br/>CAMERA RECOVERED ON SITE.</p><button id="start-button" class="primary-button">ENTER THE CLASSROOM <span>↗</span></button><p class="intro-foot">DRAG TO LOOK · HOLD & RELEASE TO SHOOT<br/>HEADPHONES RECOMMENDED</p></div>
    </section>
    <section class="screen result-screen hidden" id="result">
      <div class="result-head"><span id="shot-num">PHOTO 001</span><span>ANOMALY DETECTED</span></div>
      <div class="print-frame"><div class="print-photo"><img id="photo-result" alt="Captured paranormal photograph" /></div><div class="print-caption"><span id="print-subject">LONG EXPOSURE</span><span id="print-time">0.00s</span></div></div>
      <div class="result-bottom"><div id="result-label">TOO DARK</div><p id="result-description">The light was too faint.</p><button id="result-action" class="primary-button">RETRY <span>↗</span></button></div>
    </section>
    <section class="screen album-screen hidden" id="album"><div class="album-head"><span>PHOTO ARCHIVE</span><button id="close-album" class="outline-button">✕ CLOSE</button></div><div id="album-grid"></div></section>
    <section class="screen end-screen hidden" id="end">
      <div class="end-head">ARCHIVE COMPLETE <span>03 / 03</span></div><div class="end-title">THREE<br/>EXPOSURES.</div><div class="end-description">In every photograph, someone is looking back.</div><div id="end-photos" class="end-photos"></div><p id="end-record" class="end-last hidden">EXPOSURE 004<br/>OPERATOR: UNKNOWN</p><button id="replay" class="primary-button">REPLAY <span>↗</span></button>
    </section>
    <section class="screen death-screen hidden" id="death" aria-live="assertive">
      <div class="death-top">SIGNAL LOST <span>FILE TERMINATED</span></div>
      <div class="death-vision"><img id="death-ghost" src="./assets/ghost-near.png" alt="A ghost overwhelms the camera"/><div class="death-fault"></div></div>
      <div class="death-bottom"><div class="death-kicker">CAMERA SIGNAL TERMINATED</div><h2 id="death-heading">YOU WERE<br/>SEEN.</h2><p id="death-reason">THE PRESENCE REACHED YOU.</p><button id="death-restart" class="primary-button">RESTART <span>↗</span></button><p class="death-foot">YOUR PHOTOGRAPHS ARE LOST.</p></div>
    </section>
    <div id="rotate" class="rotate-screen"><div>▣</div><h2>ROTATE YOUR DEVICE</h2><p>Best experienced in portrait mode.</p></div>
    <div id="loading"><div class="load-mark">◌</div>LOADING FILM...</div>
  </main>
</div>`;