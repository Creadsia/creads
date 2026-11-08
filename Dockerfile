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


# Creads: EXACT upstream InfiniteTalk recipe (wlsdml1114/Infinitetalk_Runpod_hub) — the proven,
# fast config: 480p fp8 base + lightx2v cfg-step-distill LoRA, 6 steps, cfg 1, dpm++_sde, shift 11.
# This is both faster (6 steps vs 18) AND the only config that actually denoises to a real avatar;
# the earlier "PRO" variant (720p, no LoRA, 18 steps, cfg 5, unipc) output pure noise.
# IMPORTANT: .safetensors only — kijai's WanVideoModelLoader does not read GGUF (loads garbage -> noise).
#
# The ~18GB model set is NOT baked into the image: download_models.sh fetches it on the first
# worker boot (see entrypoint.sh). Baking it here forced every rebuild to re-export huge layers
# (#30 "exporting layers" alone took ~12 min), which repeatedly blew past RunPod's hard 30-minute
# build limit. Keeping the image light makes builds finish in a few minutes and never time out;
# the models land on the worker's disk at startup and a warm worker skips re-downloading.

# Overwrite MultiTalk's wav2vec2.py. The base image's new transformers returns encoder
# hidden_states=None even with output_hidden_states=True, crashing MultiTalkWav2VecEmbeds;
# downgrading transformers breaks the diffusers/WanVideoWrapper import, so instead we patch the
# node to collect per-layer hidden states via forward hooks. See patches/wav2vec2.py.
COPY patches/wav2vec2.py /ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/multitalk/wav2vec2.py

COPY . .
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]