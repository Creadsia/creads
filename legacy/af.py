#!/usr/bin/env python3
# AdForge montage tool (runs in the Higgsfield sandbox)
#   af.py qa    job.json -> qa.json   (download, transcribe each clip, compare with script)
#   af.py build job.json -> out mp4 + caps.srt (trim silences, join, burn captions)
# job: {"work":"dir","clips":[{"i":0,"url":"..","text":".."}],"aspect":"9:16|1:1",
#       "style":{"preset":1-4,"size":106},"captions":true,"out":"final.mp4","put":"<upload url>"}
import sys, json, os, re, subprocess, difflib
from collections import Counter

def sh(c): return subprocess.run(c, shell=True, capture_output=True, text=True)
JOB = json.load(open(sys.argv[2])); W = os.path.expanduser(JOB.get("work", "~/adforge/work")); os.makedirs(W, exist_ok=True)
def log(o): print(json.dumps(o, ensure_ascii=False), flush=True)
_SKIP = {"dollars","dollar","bucks","uh","um","umm","uhh"}
_U = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
_T = {"twenty":20,"thirty":30,"forty":40,"fifty":50,"sixty":60,"seventy":70,"eighty":80,"ninety":90}
_UN = {w:i for i,w in enumerate(_U)}
def _nums(toks):
    out=[]; cur=None; total=0
    def flush():
        nonlocal cur,total
        if cur is not None or total: out.append(str(total+(cur or 0)))
        cur=None; total=0
    for w in toks:
        if w.isdigit():
            if cur is not None and cur<100 and len(w)<=2 and cur%100==0 and cur: cur+=int(w); continue
            flush(); cur=int(w); continue
        if w in _UN:
            v=_UN[w]
            if cur is None: cur=v
            elif cur%10==0 and cur>=20 and cur<100 and v<10: cur+=v
            elif cur%100==0 and cur>=100: cur+=v
            else: flush(); cur=v
            continue
        if w in _T:
            v=_T[w]
            if cur is None: cur=v
            elif cur<20 and cur>0: cur=cur*100+v          # "one sixty" -> 160, "nineteen ninety" -> 1990
            elif cur%100==0 and cur>=100: cur+=v
            else: flush(); cur=v
            continue
        if w=="hundred" and cur is not None: cur*=100; continue
        if w in ("thousand","k") and (cur is not None or total): total=(total+(cur or 0))*1000; cur=None; continue
        if w=="and" and cur is not None and cur>=100: continue
        flush(); out.append(w)
    flush(); return out
def norm(t):
    t = t.lower().replace("'", "").replace("’","")
    t = re.sub(r"(?<=\d),(?=\d{3})", "", t)            # 34,000 -> 34000
    t = re.sub(r"(\d)k\b", r"\1 thousand", t)
    t = t.replace("-", " ")
    return [w for w in _nums(re.findall(r"[a-z]+|\d+", t)) if w not in _SKIP]
def same(a,b): return a==b or (len(a)>2 and len(b)>2 and difflib.SequenceMatcher(None,a,b).ratio()>=0.66)
def align(a,b):
    sa=set(a); m=[]
    for w in b:   # whisper sometimes splits numbers ("3-40" -> 3 40): glue them back when the script has the joined number
        if m and w.isdigit() and m[-1].isdigit() and (m[-1]+w) in sa: m[-1]=m[-1]+w
        else: m.append(w)
    b=m; out=[]
    for w in b:
        if w in sa: out.append(w); continue
        best=max(a, key=lambda x: difflib.SequenceMatcher(None,x,w).ratio()) if a else w
        out.append(best if same(best,w) else w)
    return out
_m = None
def model():
    global _m
    if _m is None:
        from faster_whisper import WhisperModel
        _m = WhisperModel("small" if JOB.get("lang") == "es" else "small.en", device="cpu", compute_type="int8")
    return _m
def words(f):
    segs, _ = model().transcribe(f, word_timestamps=True, language="es" if JOB.get("lang") == "es" else "en")
    return [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words if w.word.strip()]
def dur(f): return float(sh(f"ffprobe -v error -show_entries format=duration -of csv=p=0 '{f}'").stdout.strip() or 0)
def fetch_audio(c):
    if not c.get("audio"): return None
    f = f"{W}/a{c['i']}.mp3"; tag = f"{W}/a{c['i']}.url"
    if not (os.path.exists(f) and os.path.exists(tag) and open(tag).read() == c["audio"]):
        r = sh(f"curl -sf -o '{f}' '{c['audio']}'")
        if r.returncode: raise SystemExit(json.dumps({"error": f"no se pudo descargar la voz del corte {c['i']+1}"}))
        open(tag, "w").write(c["audio"])
    return f
def fetch(c):
    f = f"{W}/c{c['i']}.mp4"; tag = f"{W}/c{c['i']}.url"
    if not (os.path.exists(f) and os.path.exists(tag) and open(tag).read() == c["url"]):
        r = sh(f"curl -sf -o '{f}' '{c['url']}'")
        if r.returncode: raise SystemExit(json.dumps({"error": f"no se pudo descargar el corte {c['i']+1}"}))
        open(tag, "w").write(c["url"])
    return f

def qa():
    out = []
    for c in JOB["clips"]:
        f = fetch(c); fa = fetch_audio(c); ws = words(fa or f); heard = " ".join(x["w"] for x in ws)
        a = norm(c["text"]); b = align(a, norm(heard))   # numbers as digits, small mishearings forgiven
        sim = difflib.SequenceMatcher(None, a, b).ratio(); issues = []
        if sim < 0.9: issues.append(f"no dice el guion exacto ({sim:.0%} de coincidencia)")
        reps = sorted(set(b[k] for k in range(1, len(b)) if b[k] == b[k-1] and len(b[k]) > 2))
        def ng(t, n): return Counter(tuple(t[k:k+n]) for k in range(len(t) - n + 1))
        for n in (3, 2):
            ex = ng(b, n) - ng(a, n)
            reps += [" ".join(g) for g, v in ex.items() if ng(b, n)[g] >= 2 and " ".join(g) not in " | ".join(reps)]
        if reps: issues.append("repite: " + ", ".join(dict.fromkeys(reps)))
        extra = [w for w in b if w not in a]
        if len(extra) >= 3: issues.append("dice palabras de más: " + " ".join(extra[:8]))
        missing = [w for w in a if w not in b]
        if len(missing) >= 3: issues.append("se salta palabras: " + " ".join(missing[:8]))
        d = dur(fa or f)
        if ws and d - ws[-1]["e"] < 0.12 and not fa: issues.append("la última palabra queda cortada")
        gaps = [ws[k]["s"] - ws[k-1]["e"] for k in range(1, len(ws))]
        if gaps and max(gaps) > 1.4: issues.append(f"silencio largo a mitad de frase ({max(gaps):.1f} s)")
        def rc(t): return {tuple(t[k:k+n]) for n in (1, 2, 3) for k in range(len(t) - 2*n + 1) if t[k:k+n] == t[k+n:k+2*n] and (n > 1 or len(t[k]) > 2)}
        stutter = bool(rc(b) - rc(a))
        cut = any(t.startswith("la última palabra") for t in issues)
        severe = sim < 0.8 or cut or (stutter and sim < 0.95)   # only these are worth spending credits on
        out.append({"i": c["i"], "heard": heard, "sim": round(sim, 3), "issues": issues, "severe": bool(severe), "dur": round(d, 2)}); log(out[-1])
    json.dump(out, open(f"{W}/qa.json", "w"), ensure_ascii=False)

def frames():
    # stills of every clip (per = frames per clip at 20/50/85%), tiled two clips per row and numbered, so the AI can review them
    from PIL import Image, ImageDraw, ImageFont
    import base64
    per = max(1, min(3, int(JOB.get("per", 1)))); pos = {1: [0.5], 2: [0.3, 0.8], 3: [0.2, 0.5, 0.85]}[per]; th = 256 if per > 1 else 320
    blocks = []
    for c in JOB["clips"]:
        f = fetch(c); d = dur(f); ims = []
        for k, q in enumerate(pos):
            p = f"{W}/f{c['i']}_{k}.jpg"
            sh(f"ffmpeg -y -v error -ss {max(0.3, d * q):.2f} -i '{f}' -frames:v 1 -vf scale=-2:{th} '{p}'")
            if os.path.exists(p): ims.append(Image.open(p).convert("RGB"))
        if ims: blocks.append((c["i"], ims))
    if not blocks: raise SystemExit(json.dumps({"error": "no se pudieron sacar fotos de los cortes"}))
    tw = max(im.width for _, ims in blocks for im in ims); bw = tw * per + 8
    cols = 2 if per > 1 else min(4, len(blocks)); rows = (len(blocks) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * bw, rows * (th + 6)), (40, 40, 40)); dr = ImageDraw.Draw(sheet)
    try: ft = ImageFont.truetype("/usr/share/fonts/truetype/higgsfield/Montserrat-ExtraBold.ttf", 30)
    except Exception: ft = ImageFont.load_default()
    for k, (i, ims) in enumerate(blocks):
        x, y = (k % cols) * bw, (k // cols) * (th + 6)
        for j, im in enumerate(ims): sheet.paste(im, (x + j * tw, y))
        dr.rectangle([x, y, x + 50, y + 42], fill=(255, 225, 0)); dr.text((x + 9, y + 3), str(i + 1), fill=(0, 0, 0), font=ft)
    sheet.save(f"{W}/sheet.jpg", quality=62)
    b64 = base64.b64encode(open(f"{W}/sheet.jpg", "rb").read()).decode(); open(f"{W}/sheet.b64", "w").write(b64)
    json.dump({"n": len(blocks), "per": per, "order": [i for i, _ in blocks], "b64len": len(b64)}, open(f"{W}/frames.json", "w"))
    log({"frames": len(blocks), "per": per})

def isheet():
    # finished ad images, numbered and tiled, so the AI can read their text and check them
    from PIL import Image, ImageDraw, ImageFont
    import base64
    w = int(JOB.get("w", 480)); tiles = []
    for k, u in enumerate(JOB["urls"]):
        f = f"{W}/im{k}.img"
        if sh(f"curl -sf -o '{f}' '{u}'").returncode == 0:
            try:
                im = Image.open(f).convert("RGB"); tiles.append((k, im.resize((w, int(im.height * w / im.width)))))
            except Exception: pass
    if not tiles: raise SystemExit(json.dumps({"error": "no se pudieron bajar las imágenes"}))
    cols = min(4, len(tiles)); rows = (len(tiles) + cols - 1) // cols; h = max(t.height for _, t in tiles)
    sheet = Image.new("RGB", (cols * (w + 8), rows * (h + 8)), (60, 60, 60)); dr = ImageDraw.Draw(sheet)
    try: ft = ImageFont.truetype("/usr/share/fonts/truetype/higgsfield/Montserrat-ExtraBold.ttf", 30)
    except Exception: ft = ImageFont.load_default()
    for n, (k, t) in enumerate(tiles):
        x, y = (n % cols) * (w + 8), (n // cols) * (h + 8); sheet.paste(t, (x, y))
        dr.rectangle([x, y, x + 46, y + 40], fill=(255, 225, 0)); dr.text((x + 8, y + 3), str(k + 1), fill=(0, 0, 0), font=ft)
    sheet.save(f"{W}/sheet.jpg", quality=80)
    b64 = base64.b64encode(open(f"{W}/sheet.jpg", "rb").read()).decode(); open(f"{W}/sheet.b64", "w").write(b64)
    json.dump({"n": len(tiles), "b64len": len(b64)}, open(f"{W}/isheet.json", "w")); log({"isheet": len(tiles)})

def trim_points(f):
    D = dur(f); r = sh(f"ffmpeg -hide_banner -i '{f}' -af silencedetect=noise=-35dB:d=0.2 -f null - 2>&1")
    ev = re.findall(r"silence_(start|end): ([\d.]+)", r.stdout + r.stderr); sil = []; st = None
    for k, v in ev:
        v = float(v)
        if k == "start": st = v
        else: sil.append((st if st is not None else 0, v)); st = None
    if st is not None: sil.append((st, D))
    a, b = 0.0, D
    for s, e in sil:
        if s <= 0.05 and e < 1.5: a = max(0, e - 0.06)
        if e >= D - 0.05 and s > D - 3: b = min(D, s + 0.18)
    return a, b
def ts(t): return f"{int(t//3600)}:{int(t%3600//60):02d}:{t%60:05.2f}"
def srt(t):
    ms = int(round(t * 1000)); return f"{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}"

def make_bubble(bub, Wd):
    from PIL import Image, ImageDraw, ImageFont
    import textwrap
    FB = "/usr/share/fonts/truetype/higgsfield/Montserrat-ExtraBold.ttf"
    S = 2; maxw = int(Wd * 0.84) * S; pad = 30 * S
    f1 = ImageFont.truetype(FB, 22 * S); f2 = ImageFont.truetype(FB, 35 * S)
    user = str(bub.get("user") or "someone")[:30]; text = str(bub.get("text"))[:160]
    head = f"Reply to {user}'s comment"
    lines = []
    for para in text.split("\n"):
        cur = ""
        for w in para.split():
            cand = (cur + " " + w).strip()
            if f2.getlength(cand) > maxw - 2 * pad and cur: lines.append(cur); cur = w
            else: cur = cand
        if cur: lines.append(cur)
    lh = int(35 * S * 1.26); av = 40 * S
    wbox = int(min(maxw, max(f1.getlength(head) + av + 12 * S, max(f2.getlength(l) for l in lines)) + 2 * pad))
    hbox = pad + av + 10 * S + lh * len(lines) + pad
    img = Image.new("RGBA", (wbox + 8 * S, hbox + 22 * S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    sh_ = Image.new("RGBA", img.size, (0, 0, 0, 0)); ImageDraw.Draw(sh_).rounded_rectangle([4 * S, 6 * S, wbox + 4 * S, hbox + 6 * S], 28 * S, fill=(0, 0, 0, 70)); img = Image.alpha_composite(img, sh_); d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, wbox, hbox], 28 * S, fill=(255, 255, 255, 255))
    d.polygon([(pad + 8 * S, hbox - 1), (pad + 30 * S, hbox - 1), (pad + 12 * S, hbox + 18 * S)], fill=(255, 255, 255, 255))
    col = tuple(int(str(bub.get("color", "#E8A87C")).lstrip("#")[k:k+2], 16) for k in (0, 2, 4))
    d.ellipse([pad, pad, pad + av, pad + av], fill=col)
    fi = ImageFont.truetype(FB, 20 * S); ch = user[:1].upper(); d.text((pad + av / 2, pad + av / 2), ch, font=fi, fill="white", anchor="mm")
    d.text((pad + av + 12 * S, pad + av / 2), head, font=f1, fill=(130, 130, 130), anchor="lm")
    y = pad + av + 10 * S
    for l in lines: d.text((pad, y), l, font=f2, fill=(22, 22, 22)); y += lh
    img = img.resize((img.width // S, img.height // S), Image.LANCZOS); out = f"{W}/bubble.png"; img.save(out); return out

def build():
    asp = JOB.get("aspect", "9:16"); Wd, Ht = (720, 720) if asp == "1:1" else (720, 1280)
    st = JOB.get("style", {}); preset = int(st.get("preset", 1)); size = int(st.get("size", 106))
    if asp == "1:1": size = int(size * 0.8)
    lst = open(f"{W}/list.txt", "w")
    for c in sorted(JOB["clips"], key=lambda x: x["i"]):
        f = fetch(c); fa = fetch_audio(c); t = f"{W}/t{c['i']}.mp4"
        VF = f"fps=30,scale={Wd}:{Ht}:force_original_aspect_ratio=increase,crop={Wd}:{Ht},setsar=1"
        if fa:
            a, b = trim_points(fa); L = max(0.5, b - a)
            sh(f"ffmpeg -v error -y -i '{f}' -ss {a} -to {b} -i '{fa}' -filter_complex '[0:v]{VF},tpad=stop_mode=clone:stop_duration=20,trim=duration={L:.3f},setpts=PTS-STARTPTS[v];[1:a]asetpts=PTS-STARTPTS,aresample=44100[aa]' -map '[v]' -map '[aa]' -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -ac 2 -b:a 160k -shortest '{t}'")
        else:
            a, b = trim_points(f)
            sh(f"ffmpeg -v error -y -ss {a} -to {b} -i '{f}' -vf '{VF}' -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -ar 44100 -ac 2 -b:a 160k '{t}'")
        lst.write(f"file '{t}'\n")
    lst.close(); log({"step": "joined"})
    sh(f"ffmpeg -v error -y -f concat -safe 0 -i {W}/list.txt -c copy {W}/clean.mp4")
    ws = []
    for w in words(f"{W}/clean.mp4"):
        if ws and re.match(r"^[,.]?\d{3}[.,]?$", w["w"]) and re.search(r"\d$", ws[-1]["w"]):
            ws[-1]["w"] += w["w"] if w["w"].startswith(",") else "," + w["w"]; ws[-1]["e"] = w["e"]; continue
        ws.append(w)
    MAXW, MAXC = (3, 15) if size >= 92 else (3, 19) if size >= 72 else (4, 26)
    cues = []; cur = []
    for i, w in enumerate(ws):
        if cur and len(" ".join(x["w"] for x in cur + [w])) > MAXC: cues.append(cur); cur = []
        cur.append(w); nx = ws[i+1] if i + 1 < len(ws) else None
        if len(cur) >= MAXW or re.search(r"[.,!?:]$", w["w"]) or (nx and nx["s"] - w["e"] > 0.35) or not nx:
            cues.append(cur); cur = []
    up = preset == 4; col = "&H0000E1FF" if preset == 4 else "&H00FFFFFF"
    border, back, outl = (3, "&HD0000000", max(8, size // 7)) if preset == 3 else (1, "&H64000000", max(4, size // 10))
    mv = int(Ht * (0.26 if asp == "9:16" else 0.12))
    ass = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {Wd}", f"PlayResY: {Ht}", "WrapStyle: 0", "", "[V4+ Styles]",
           "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
           f"Style: Cap,Montserrat ExtraBold,{size},{col},&H00FFFFFF,&H00000000,{back},-1,0,0,0,100,100,0,0,{border},{outl},{0 if preset==3 else 2},2,40,40,{mv},1", "", "[Events]",
           "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    S = []
    for k, c in enumerate(cues):
        a = c[0]["s"]; b = c[-1]["e"]
        if k + 1 < len(cues): b = min(max(b + 0.15, a + 0.5), cues[k+1][0]["s"])
        toks = [x["w"] for x in c]; toks[-1] = toks[-1].rstrip(",")
        disp = [t.upper() if up else t for t in toks]
        if preset == 2:
            for j, w in enumerate(c):
                s0 = a if j == 0 else w["s"]; e0 = c[j+1]["s"] if j + 1 < len(c) else b
                if e0 <= s0: continue
                line = " ".join(("{\\c&H00E1FF&}" + t + "{\\c&HFFFFFF&}") if q == j else t for q, t in enumerate(disp))
                ass.append(f"Dialogue: 0,{ts(s0)},{ts(e0)},Cap,,0,0,0,,{line}")
        else:
            ass.append(f"Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{' '.join(disp)}")
        S.append(f"{k+1}\n{srt(a)} --> {srt(b)}\n{' '.join(toks)}\n")
    open(f"{W}/caps.ass", "w").write("\n".join(ass) + "\n"); open(f"{W}/caps.srt", "w").write("\n".join(S))
    out = f"{W}/{JOB.get('out', 'final.mp4')}"
    vf = f"ass={W}/caps.ass" if JOB.get("captions", True) else "null"
    bub = JOB.get("bubble")
    if bub and bub.get("text"):
        png = make_bubble(bub, Wd); until = float(bub.get("until", 4.5)); y = int(Ht * 0.07)
        r = sh(f"ffmpeg -v error -y -i {W}/clean.mp4 -loop 1 -i '{png}' -filter_complex \"[0:v]{vf}[c];[1:v]format=rgba,fade=t=out:st={until-0.3}:d=0.3:alpha=1[b];[c][b]overlay=(W-w)/2:{y}:enable='lte(t,{until})':shortest=1[v]\" -map '[v]' -map 0:a -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p -c:a copy -movflags +faststart '{out}'")
    else:
        r = sh(f"ffmpeg -v error -y -i {W}/clean.mp4 -vf '{vf}' -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p -c:a copy -movflags +faststart '{out}'")
    if r.returncode: raise SystemExit(json.dumps({"error": "falló el render: " + r.stderr[-300:]}))
    res = {"out": out, "dur": round(dur(out), 2), "cues": len(cues), "srt": open(f"{W}/caps.srt").read()}
    if JOB.get("put"):
        p = sh(f"curl -sf -o /dev/null -w '%{{http_code}}' -X PUT -H 'Content-Type: video/mp4' -H 'If-None-Match: *' --upload-file '{out}' '{JOB['put']}'")
        res["put"] = p.stdout.strip()
    json.dump(res, open(f"{W}/build.json", "w"), ensure_ascii=False); log({"step": "done", "dur": res["dur"], "put": res.get("put")})

if __name__ == "__main__":
    {"qa": qa, "build": build, "frames": frames, "isheet": isheet}[sys.argv[1]]()
