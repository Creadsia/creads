# Use specific version of nvidia cuda image
FROM wlsdml1114/engui_genai-base_blackwell:1.1 as runtime

# wget 설치 (URL 다운로드를 위해)
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

RUN pip install -U "huggingface_hub[hf_transfer]"
RUN pip install runpod websocket-client librosa

WORKDIR /

RUN git clone https://github.com/comfyanonymous/ComfyUI.git && \
    cd /ComfyUI && \
    pip install -r requirements.txt

RUN cd /ComfyUI/custom_nodes && \
    git clone https://github.com/Comfy-Org/ComfyUI-Manager.git && \
    cd ComfyUI-Manager && \
    pip install -r requirements.txt

RUN cd /ComfyUI/custom_nodes && \
    git clone https://github.com/city96/ComfyUI-GGUF && \
    cd ComfyUI-GGUF && \
    pip install -r requirements.txt

RUN cd /ComfyUI/custom_nodes && \
    git clone https://github.com/kijai/ComfyUI-KJNodes && \
    cd ComfyUI-KJNodes && \
    pip install -r requirements.txt

RUN cd /ComfyUI/custom_nodes && \
    git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite && \
    cd ComfyUI-VideoHelperSuite && \
    pip install -r requirements.txt
    
RUN cd /ComfyUI/custom_nodes && \
    git clone https://github.com/orssorbit/ComfyUI-wanBlockswap

RUN cd /ComfyUI/custom_nodes && \
    git clone https://github.com/kijai/ComfyUI-MelBandRoFormer && \
    cd ComfyUI-MelBandRoFormer && \
    pip install -r requirements.txt

RUN cd /ComfyUI/custom_nodes && \
    git clone https://github.com/kijai/ComfyUI-WanVideoWrapper && \
    cd ComfyUI-WanVideoWrapper && \
    pip install -r requirements.txt


# Creads PRO (I2V single-person, 720p, no distill): download ONLY the models the I2V_single.json workflow uses,
# so the whole image builds inside RunPod's 30-min limit (the unused Multi / 480p / distill models were removed).
# 720p base uses the Q6_K quant (~12GB): visually ~identical to Q8 but downloads/loads faster.

# InfiniteTalk single-person audio model (node 120)
RUN wget -q https://huggingface.co/Kijai/WanVideo_comfy_fp8_scaled/resolve/main/InfiniteTalk/Wan2_1-InfiniteTalk-Single_fp8_e4m3fn_scaled_KJ.safetensors -O /ComfyUI/models/diffusion_models/Wan2_1-InfiniteTalk-Single_fp8_e4m3fn_scaled_KJ.safetensors

# 720p base model (Q6_K, ~12GB, node 122)
RUN wget -q https://huggingface.co/city96/Wan2.1-I2V-14B-720P-gguf/resolve/main/wan2.1-i2v-14b-720p-Q6_K.gguf -O /ComfyUI/models/diffusion_models/wan2.1-i2v-14b-720p-Q6_K.gguf

# VAE (node 129), text encoder (node 241), CLIP vision (node 238), Mel-Band RoFormer audio separation (node 301)
RUN wget -q https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan2_1_VAE_bf16.safetensors -O /ComfyUI/models/vae/Wan2_1_VAE_bf16.safetensors
RUN wget -q https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/umt5-xxl-enc-fp8_e4m3fn.safetensors -O /ComfyUI/models/text_encoders/umt5-xxl-enc-fp8_e4m3fn.safetensors
RUN wget -q https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors -O /ComfyUI/models/clip_vision/clip_vision_h.safetensors
RUN wget -q https://huggingface.co/Kijai/MelBandRoFormer_comfy/resolve/main/MelBandRoformer_fp16.safetensors -O /ComfyUI/models/diffusion_models/MelBandRoformer_fp16.safetensors


# Overwrite MultiTalk's wav2vec2.py AFTER the heavy model downloads, so this tiny change never
# invalidates the download layers' cache (putting that COPY before the downloads pushed a prior
# build past RunPod's 30-min limit). The base image's new transformers returns encoder
# hidden_states=None even with output_hidden_states=True, crashing MultiTalkWav2VecEmbeds;
# downgrading transformers breaks the diffusers/WanVideoWrapper import, so instead we patch the
# node to collect per-layer hidden states via forward hooks. See patches/wav2vec2.py.
COPY patches/wav2vec2.py /ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/multitalk/wav2vec2.py

COPY . .
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]