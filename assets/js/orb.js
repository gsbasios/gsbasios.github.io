(() => {
  'use strict';

  const canvas = document.querySelector('.orb');
  if (!canvas) return;

  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power'
  });

  if (!gl) {
    root.classList.add('orb-off');
    return;
  }

  const vertexSource = `
    attribute vec2 aPos;
    void main() {
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform vec3 uOrb;
    uniform float uTheme;
    uniform float uAppear;
    uniform float uLift;
    uniform vec2 uShade;
    uniform vec3 uKey;
    uniform mat3 uEnv;

    const vec3 KEY = vec3(-0.4466, 0.5955, 0.6680);

    float panel(vec3 d, vec3 c, vec2 size, float soft) {
      float k = dot(d, c);
      if (k <= 0.0) return 0.0;
      vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), c));
      vec3 rise = cross(c, side);
      vec2 q = vec2(dot(d, side), dot(d, rise)) / k;
      vec2 e = abs(q) - size;
      float dist = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0);
      return 1.0 - smoothstep(-soft, soft, dist);
    }

    float strip(vec3 d, vec3 c, float width, float span) {
      float k = dot(d, c);
      if (k <= 0.0) return 0.0;
      vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), c));
      vec3 rise = cross(c, side);
      vec2 q = vec2(dot(d, side), dot(d, rise)) / k;
      float across = 1.0 - smoothstep(width * 0.35, width, abs(q.x));
      float along = 1.0 - smoothstep(span * 0.2, span, abs(q.y - span * 0.18));
      return across * along * along;
    }

    float room(vec3 d, float dark) {
      float front = smoothstep(0.05, 0.9, d.z);
      float behind = smoothstep(-0.12, -0.8, d.z);
      float ceiling = smoothstep(0.15, 0.95, d.y) * (1.0 - front);
      float ground = smoothstep(-0.08, -0.55, d.y) * (1.0 - front);
      float bright = 0.016 + 0.95 * behind * mix(0.78, 1.0, smoothstep(-0.6, 0.4, d.y)) + 0.12 * ceiling + 0.2 * ground;
      bright = mix(bright, 0.003, front);
      float dim = 0.0015 + 0.012 * ground;
      return mix(bright, dim, dark);
    }

    float lights(vec3 d, float dark) {
      float key = panel(d, KEY, vec2(0.3, 0.18), 0.1);
      float left = strip(d, normalize(vec3(-0.82, 0.04, -0.58)), 0.05, 0.85);
      float right = strip(d, normalize(vec3(0.88, 0.02, -0.48)), 0.035, 0.7);
      return key * mix(22.0, 9.0, dark) + left * mix(9.0, 6.5, dark) + right * mix(4.5, 3.6, dark);
    }

    float shoulder(float x) {
      return x < 0.8 ? x : 0.8 + 0.2 * (1.0 - exp(-(x - 0.8) / 0.2));
    }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 p = (frag - uOrb.xy) / uOrb.z;
      float d2 = dot(p, p);
      float len = sqrt(d2);

      vec2 sp = (frag - uOrb.xy) / uOrb.z - uShade;
      float spread = 0.34 + 0.3 * uLift;
      float shadow = (1.0 - smoothstep(0.94 - spread, 0.94 + spread * 1.5, length(sp))) * mix(0.17, 0.11, uLift) * (1.0 - uTheme);
      float gap = max(len - 1.0, 0.0);
      float halo = exp(-gap * gap * 7.0) * 0.065 * uTheme;
      vec4 under = vec4(vec3(halo), shadow + halo);

      float grain = fract(52.9829189 * fract(dot(frag, vec2(0.06711056, 0.00583715)))) - 0.5;

      if (len > 1.0 + 2.0 / uOrb.z) {
        vec4 outside = under + vec4(0.0, 0.0, 0.0, grain / 255.0) * step(0.003, under.a);
        gl_FragColor = clamp(outside, 0.0, 1.0) * uAppear;
        return;
      }

      vec3 n = vec3(p, sqrt(max(1.0 - d2, 0.0)));
      vec3 ne = uEnv * n;
      vec3 re = uEnv * vec3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
      float fres = 0.04 + 0.96 * pow(1.0 - n.z, mix(6.5, 5.0, uTheme));
      float env = room(re, uTheme) + lights(re, uTheme);

      float ndl = dot(ne, KEY);
      float wrap = clamp((ndl + 0.7) / 1.7, 0.0, 1.0);
      float milk = 0.07 + 0.84 * wrap * wrap * (3.0 - 2.0 * wrap);
      float scatter = 0.2 * smoothstep(0.55, 1.0, len) * clamp(0.45 - ndl, 0.0, 1.0);

      vec2 away = -normalize(uKey.xy + vec2(0.0001));
      float facing = clamp(dot(p / max(len, 0.0001), away), 0.0, 1.0);
      float band = smoothstep(0.55, 0.9, len) * (1.0 - smoothstep(0.9, 0.995, len));
      float caustic = pow(facing, 4.0) * band * 0.035;
      float smoke = 0.0015 + caustic;

      float body = mix(smoke, milk + scatter, uTheme);
      float tone = pow(clamp(shoulder(mix(body, env, fres)), 0.0, 1.0), 1.0 / 2.2) + grain / 255.0;

      float a = clamp((1.0 - len) * uOrb.z + 0.5, 0.0, 1.0);
      vec4 color = vec4(vec3(tone) * a, a) + under * (1.0 - a);
      gl_FragColor = clamp(color, 0.0, 1.0) * uAppear;
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  function build() {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const names = ['uOrb', 'uTheme', 'uAppear', 'uLift', 'uShade', 'uKey', 'uEnv'];
    return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
  }

  let uniforms = build();
  if (!uniforms) {
    root.classList.add('orb-off');
    return;
  }

  const KEY = [-0.4466, 0.5955, 0.668];
  const STORE = 'gsb-orb';
  const stages = [...document.querySelectorAll('[data-orb]')];
  const fallback = { x: 0.72, y: 0.42, r: 0.32, d: 1 };

  let anchors = [];
  let quality = 1;
  let slowFrames = 0;
  let born = 0;
  let last = 0;
  let frame = 0;
  let theme = root.dataset.theme === 'dark' ? 1 : 0;
  let themeGoal = theme;
  let carried = false;

  const orb = { x: 0, y: 0, r: 0, d: 1, vx: 0, vy: 0, vr: 0, vd: 0, ready: false };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  function readAnchors() {
    anchors = stages.map((stage) => {
      const style = getComputedStyle(stage);
      const value = (name, backup) => {
        const parsed = parseFloat(style.getPropertyValue(name));
        return Number.isFinite(parsed) ? parsed : backup;
      };
      return {
        stage,
        x: value('--orb-x', fallback.x),
        y: value('--orb-y', fallback.y),
        r: value('--orb-r', fallback.r),
        d: value('--orb-d', fallback.d)
      };
    });
  }

  function aim(height) {
    if (calm.matches || !anchors.length) return anchors[0] || fallback;

    let x = 0;
    let y = 0;
    let r = 0;
    let d = 0;
    let total = 0;

    for (const anchor of anchors) {
      const box = anchor.stage.getBoundingClientRect();
      const seen = Math.max(0, Math.min(box.bottom, height) - Math.max(box.top, 0));
      const share = Math.max(seen / height, seen / Math.max(box.height, 1));
      const weight = share * share;
      x += anchor.x * weight;
      y += anchor.y * weight;
      r += anchor.r * weight;
      d += anchor.d * weight;
      total += weight;
    }

    if (!total) return anchors[anchors.length - 1];
    return { x: x / total, y: y / total, r: r / total, d: d / total };
  }

  function follow(target, dt) {
    if (!orb.ready || calm.matches) {
      orb.x = target.x;
      orb.y = target.y;
      orb.r = target.r;
      orb.d = target.d;
      orb.vx = orb.vy = orb.vr = orb.vd = 0;
      orb.ready = true;
      return;
    }

    const omega = 2.8;
    const zeta = 0.78;
    for (const key of ['x', 'y', 'r', 'd']) {
      const speed = 'v' + key;
      const pull = omega * omega * (target[key] - orb[key]) - 2 * zeta * omega * orb[speed];
      orb[speed] += pull * dt;
      orb[key] += orb[speed] * dt;
    }
  }

  function fit() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2) * quality;
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    return ratio;
  }

  function ease(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function render(now, dt) {
    if (gl.isContextLost()) return;

    const ratio = fit();
    const width = canvas.clientWidth;
    const tall = canvas.clientHeight;
    const height = window.innerHeight;
    const unit = Math.min(width, height);
    const moving = !calm.matches;
    const t = moving ? (performance.timeOrigin + now) / 1000 : 0;

    if (!born) born = now;
    const appear = moving && !carried ? ease(Math.min(1, (now - born) / 1900)) : 1;

    if (moving && fine.matches) {
      const blend = 1 - Math.exp(-dt * 2.4);
      pointer.sx += (pointer.x - pointer.sx) * blend;
      pointer.sy += (pointer.y - pointer.sy) * blend;
    } else {
      pointer.sx = pointer.sy = 0;
    }

    if (themeGoal !== theme) {
      theme = moving ? theme + (themeGoal - theme) * (1 - Math.exp(-dt * 7)) : themeGoal;
      if (Math.abs(themeGoal - theme) < 0.002) theme = themeGoal;
    }

    follow(aim(height), dt);

    const bob = Math.sin(t * 0.62);
    const driftX = orb.d * (0.03 * Math.sin(t * 0.17) + 0.016 * Math.sin(t * 0.093 + 2.1));
    const driftY = orb.d * (0.024 * (0.5 - 0.5 * Math.cos(t * 0.14)) + 0.012 * (0.5 + 0.5 * Math.sin(t * 0.067 + 0.7)) + 0.01 * (0.5 - 0.5 * bob));
    const lift = 0.5 + 0.5 * bob;

    const cx = (orb.x + driftX - pointer.sx * 0.007) * width;
    const cy = (orb.y + driftY - pointer.sy * 0.007) * height;
    const radius = orb.r * unit * (0.93 + 0.07 * appear);

    const yaw = 0.16 * Math.sin(t * 0.09) - pointer.sx * 0.34;
    const pitch = 0.07 * Math.sin(t * 0.07 + 1) - pointer.sy * 0.22;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    const key = [
      cosYaw * KEY[0] - sinYaw * KEY[2],
      sinYaw * sinPitch * KEY[0] + cosPitch * KEY[1] + cosYaw * sinPitch * KEY[2],
      sinYaw * cosPitch * KEY[0] - sinPitch * KEY[1] + cosYaw * cosPitch * KEY[2]
    ];
    const reach = 0.5 * (1 + 0.3 * lift);

    gl.uniform3f(uniforms.uOrb, cx * ratio, (tall - cy) * ratio, radius * ratio);
    gl.uniform1f(uniforms.uTheme, theme);
    gl.uniform1f(uniforms.uAppear, appear);
    gl.uniform1f(uniforms.uLift, lift);
    gl.uniform2f(uniforms.uShade, -key[0] * reach, -key[1] * reach);
    gl.uniform3f(uniforms.uKey, key[0], key[1], key[2]);
    gl.uniformMatrix3fv(uniforms.uEnv, false, [
      cosYaw, 0, -sinYaw,
      sinYaw * sinPitch, cosPitch, cosYaw * sinPitch,
      sinYaw * cosPitch, -sinPitch, cosYaw * cosPitch
    ]);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;

    if (dt > 0.026) slowFrames += 1;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 45 && quality > 0.6) {
      quality = Math.max(0.6, quality - 0.15);
      slowFrames = 0;
    }

    render(now, dt);
  }

  function start() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (calm.matches) {
      render(performance.now(), 0);
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function refresh() {
    readAnchors();
    if (calm.matches) render(performance.now(), 0);
  }

  function recall() {
    if (calm.matches) return;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(STORE)); } catch (error) {}
    if (!saved || Date.now() - saved.at > 5000) return;
    if (![saved.x, saved.y, saved.r, saved.d].every(Number.isFinite)) return;
    Object.assign(orb, { x: saved.x, y: saved.y, r: saved.r, d: saved.d, ready: true });
    carried = true;
  }

  function remember() {
    if (!orb.ready) return;
    const state = { x: orb.x, y: orb.y, r: orb.r, d: orb.d, at: Date.now() };
    try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (error) {}
  }

  readAnchors();
  recall();

  window.addEventListener('pagehide', remember);

  new ResizeObserver(refresh).observe(document.documentElement);

  new MutationObserver(() => {
    themeGoal = root.dataset.theme === 'dark' ? 1 : 0;
    if (calm.matches || root.classList.contains('is-theming')) theme = themeGoal;
    render(performance.now(), 0);
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  window.addEventListener('pointermove', (event) => {
    if (!fine.matches) return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  calm.addEventListener('change', () => {
    orb.ready = false;
    start();
  });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
  });

  canvas.addEventListener('webglcontextrestored', () => {
    uniforms = build();
    if (!uniforms) {
      root.classList.add('orb-off');
      return;
    }
    start();
  });

  start();
})();
