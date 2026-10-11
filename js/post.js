'use strict';
// WebGL2 post-process: the whole scene is drawn to a 2D canvas, uploaded as a texture,
// then warped (gravitational lenses, shockwave rings), split chromatically and bloomed.
const POST = {
  gl: null, ok: false, MAX: 16,
  init(canvas) {
    let gl = null;
    try { gl = canvas.getContext('webgl2', { antialias: false, alpha: false }); } catch (e) { }
    if (!gl) return false;
    const vs = `#version 300 es
in vec2 a; out vec2 uv; void main(){ uv=a*.5+.5; gl_Position=vec4(a,0.,1.); }`;
    const fs = `#version 300 es
precision highp float;
uniform sampler2D T; uniform vec2 R;
uniform vec4 src[16]; uniform float typ[16];
uniform vec4 hole[4]; // wormhole rings as pairs (0,1) and (2,3): centre.xy, radius; radius 0 = unused
uniform float ca, pulse, inv, bloom, vig;
in vec2 uv; out vec4 o;
void main(){
  float asp=R.x/R.y; vec2 p=(uv-.5)*(1.-pulse*.025)+.5; float cab=ca;
  for(int i=0;i<16;i++){
    if(typ[i]<.5) continue;
    vec2 d=p-src[i].xy; d.x*=asp; float r=length(d)+1e-4; vec2 n=d/r; n.x/=asp;
    float z=src[i].z, w=src[i].w;
    if(typ[i]<1.5){
      p-=n*w*z*z/(r*r+z*z*.25)*exp(-r*r/(z*z*6.));
    } else {
      float k=exp(-pow((r-z)/.035,2.)); p+=n*k*w; cab+=k*abs(w)*.5;
    }
  }
  // Wormholes. Inside a ring: sample the scene outside its twin through the inversion, fading
  // toward the centre (which is the far distance). Just outside a ring: add whatever is poking
  // inside the twin, through the same map, so an object straddling a ring is whole on both sides.
  float dim=1.; vec3 poke=vec3(0.);
  for(int i=0;i<4;i++){
    float hr=hole[i].z; if(hr<=0.) continue;
    int j=(i/2)*2+1-(i-(i/2)*2);
    vec2 d=p-hole[i].xy; d.x*=asp; float rho=length(d);
    if(rho<hr){
      vec2 m=-d*(hr*hr/max(rho*rho,1e-7)); m.x/=asp; p=hole[j].xy+m;
      dim=smoothstep(.1,.55,rho/hr); break;
    } else if(rho<hr*2.){
      vec2 m=-d*(hr*hr/(rho*rho)); m.x/=asp; poke=max(poke,texture(T,hole[j].xy+m).rgb);
    }
  }
  vec2 c=p-.5; float e=cab*(.4+dot(c,c)*3.);
  vec3 col=vec3(texture(T,p+c*e).r, texture(T,p).g, texture(T,p-c*e).b);
  vec3 bl=textureLod(T,p,2.5).rgb*.4+textureLod(T,p,4.).rgb*.4+textureLod(T,p,5.5).rgb*.35;
  col+=bl*bloom;
  col=max(col*dim,poke);
  col=mix(col,1.-col,inv);
  col*=1.-vig*dot(c,c)*1.5;
  if(p.x<0.||p.x>1.||p.y<0.||p.y>1.) col*=.25;
  o=vec4(col,1.);
}`;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    try {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      this.u = {};
      for (const n of ['T', 'R', 'src', 'typ', 'hole', 'ca', 'pulse', 'inv', 'bloom', 'vig']) this.u[n] = gl.getUniformLocation(pr, n);
      gl.uniform1i(this.u.T, 0);
      this.srcA = new Float32Array(this.MAX * 4); this.typA = new Float32Array(this.MAX); this.holeA = new Float32Array(16);
    } catch (e) { console.warn('post-process disabled:', e); return false; }
    this.gl = gl; this.ok = true;
    return true;
  },
  // sources: [type(1 lens, 2 ring), x, y, radiusPx, strength]
  draw(scene, sources, o) {
    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.typA.fill(0);
    const n = Math.min(sources.length, this.MAX);
    for (let i = 0; i < n; i++) {
      const s = sources[i];
      this.typA[i] = s[0];
      this.srcA[i * 4] = s[1] / W; this.srcA[i * 4 + 1] = 1 - s[2] / H; this.srcA[i * 4 + 2] = s[3] / H; this.srcA[i * 4 + 3] = s[4];
    }
    this.holeA.fill(0);
    (o.holes || []).slice(0, 4).forEach((h, i) => { this.holeA[i * 4] = h.x / W; this.holeA[i * 4 + 1] = 1 - h.y / H; this.holeA[i * 4 + 2] = h.r / H; });
    gl.uniform4fv(this.u.hole, this.holeA);
    gl.uniform4fv(this.u.src, this.srcA); gl.uniform1fv(this.u.typ, this.typA);
    gl.uniform2f(this.u.R, W, H);
    gl.uniform1f(this.u.ca, o.ca); gl.uniform1f(this.u.pulse, o.pulse); gl.uniform1f(this.u.inv, o.inv);
    gl.uniform1f(this.u.bloom, o.bloom); gl.uniform1f(this.u.vig, o.vig);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
};
