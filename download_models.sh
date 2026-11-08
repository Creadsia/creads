#!/bin/bash
# Creads: download the InfiniteTalk model set at worker startup instead of baking it
# into the Docker image. Baking ~18GB of models made every image rebuild re-export
# huge layers, which repeatedly blew past RunPod's 30-minute build limit. With the
# models downloaded here, the image stays tiny (code + ComfyUI + custom nodes only),
# so builds finish in a few minutes and never time out. Each file is fetched only if
# it is missing, so a warm worker (or a future network volume) skips the download.

MODELS_ROOT="${COMFY_MODELS_DIR:-/ComfyUI/models}"
DIFF="$MODELS_ROOT/diffusion_models"
LORA="$MODELS_ROOT/loras"
VAE="$MODELS_ROOT/vae"
TENC="$MODELS_ROOT/text_encoders"
CLIPV="$MODELS_ROOT/clip_vision"
mkdir -p "$DIFF" "$LORA" "$VAE" "$TENC" "$CLIPV"

# hf_transfer makes huggingface downloads much faster when available.
export HF_HUB_ENABLE_HF_TRANSFER=1

# Final Content-Length for a URL, following HuggingFace's redirect to its CDN.
remote_size() {
  curl -sIL "$1" 2>/dev/null \
    | awk 'BEGIN{IGNORECASE=1} /^content-length:/{v=$2} END{gsub(/[\r ]/,"",v); print v}'
}

dl() {
  local url="$1" out="$2"
  local expected have got
  expected="$(remote_size "$url")"

  # Keep an existing copy ONLY if its size matches the server's. A concurrent
  # download earlier corrupted the 16GB base model (truncated safetensors ->
  # "Tensor extends past the end of the file"), and the old existence-only check
  # happily reused the broken file forever. Verify the size and re-download if
  # it is incomplete; if the server size can't be read, keep the file rather
  # than risk a re-download loop.
  if [ -s "$out" ]; then
    have="$(stat -c%s "$out" 2>/dev/null || echo 0)"
    if [ -n "$expected" ] && [ "$have" = "$expected" ]; then
      echo "✓ ya existe (tamaño OK $have): $out"
      return 0
    fi
    if [ -n "$expected" ]; then
      echo "⚠ archivo incompleto/corrupto (tiene $have, esperado $expected) -> re-bajando: $out"
      rm -f "$out"
    else
      echo "✓ ya existe (no se pudo verificar tamaño): $out"
      return 0
    fi
  fi

  echo "⬇ bajando: $out (esperado ${expected:-?} bytes)"
  for i in 1 2 3; do
    if wget -q "$url" -O "$out.tmp"; then
      got="$(stat -c%s "$out.tmp" 2>/dev/null || echo 0)"
      if [ -n "$expected" ] && [ "$got" != "$expected" ]; then
        echo "   descarga incompleta (got $got, esperado $expected), reintento $i"
        rm -f "$out.tmp"
        sleep 3
        continue
      fi
      mv "$out.tmp" "$out"
      echo "✓ listo ($got bytes): $out"
      return 0
    fi
    echo "   reintento $i falló para $out"
    rm -f "$out.tmp"
    sleep 3
  done
  echo "✗ ERROR: no se pudo bajar $out"
  return 1
}

echo "=== Creads: preparando modelos InfiniteTalk (480p + distill lora) ==="

# InfiniteTalk single-person audio model (workflow node 120)
dl https://huggingface.co/Kijai/WanVideo_comfy_fp8_scaled/resolve/main/InfiniteTalk/Wan2_1-InfiniteTalk-Single_fp8_e4m3fn_scaled_KJ.safetensors \
   "$DIFF/Wan2_1-InfiniteTalk-Single_fp8_e4m3fn_scaled_KJ.safetensors"

# 480p base model (fp8_e4m3fn safetensors, node 122)
dl https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan2_1-I2V-14B-480P_fp8_e4m3fn.safetensors \
   "$DIFF/Wan2_1-I2V-14B-480P_fp8_e4m3fn.safetensors"

# cfg-step-distill LoRA (node 138) — makes 6 steps enough and denoises to a real avatar
dl https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors \
   "$LORA/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors"

# VAE (node 129)
dl https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan2_1_VAE_bf16.safetensors \
   "$VAE/Wan2_1_VAE_bf16.safetensors"

# Text encoder (node 241)
dl https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/umt5-xxl-enc-fp8_e4m3fn.safetensors \
   "$TENC/umt5-xxl-enc-fp8_e4m3fn.safetensors"

# CLIP vision (node 238)
dl https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors \
   "$CLIPV/clip_vision_h.safetensors"

# Mel-Band RoFormer audio separation (node 301)
dl https://huggingface.co/Kijai/MelBandRoFormer_comfy/resolve/main/MelBandRoformer_fp16.safetensors \
   "$DIFF/MelBandRoformer_fp16.safetensors"

echo "=== Creads: modelos listos ==="
