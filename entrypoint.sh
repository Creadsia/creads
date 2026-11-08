#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Models live on a RunPod network volume mounted at /runpod-volume, NOT in the
# image and NOT on the 5GB container disk (which is far too small for the ~18GB
# set — downloading into it fails with "no space left"). Point /ComfyUI/models at
# the volume so both the downloader and ComfyUI use it. The first worker populates
# the volume (~18GB, one time); every later worker finds the files already there
# and starts in seconds. This keeps image builds tiny (no 30-min build timeout)
# AND cold starts fast.
if [ -d /runpod-volume ]; then
    echo "Network volume detected: storing models on /runpod-volume/models"
    mkdir -p /runpod-volume/models
    rm -rf /ComfyUI/models
    ln -s /runpod-volume/models /ComfyUI/models
else
    echo "WARNING: no /runpod-volume mounted — falling back to container disk (may run out of space)"
fi

# Download the model set if missing (idempotent: skips files already on the volume).
echo "Checking / downloading models..."
bash /download_models.sh

# Start ComfyUI in the background
echo "Starting ComfyUI in the background..."
python /ComfyUI/main.py --listen --use-sage-attention &

# Wait for ComfyUI to be ready
echo "Waiting for ComfyUI to be ready..."
max_wait=120  # 최대 2분 대기
wait_count=0
while [ $wait_count -lt $max_wait ]; do
    if curl -s http://127.0.0.1:8188/ > /dev/null 2>&1; then
        echo "ComfyUI is ready!"
        break
    fi
    echo "Waiting for ComfyUI... ($wait_count/$max_wait)"
    sleep 2
    wait_count=$((wait_count + 2))
done

if [ $wait_count -ge $max_wait ]; then
    echo "Error: ComfyUI failed to start within $max_wait seconds"
    exit 1
fi

# Start the handler in the foreground
# 이 스크립트가 컨테이너의 메인 프로세스가 됩니다.
echo "Starting the handler..."
exec python handler.py