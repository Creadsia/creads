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

dl() {
  local url="$1" out="$2"
  if [ -s "$out" ]; then
    echo "✓ ya existe: $out"
    return 0
  fi
  echo "⬇ bajando: $out"
  for i in 1 2 3; do
    if wget -q --show-progress=off "$url" -O "$out.tmp"; then
      mv "$out.tmp" "$out"
      echo "✓ listo: $out"
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
