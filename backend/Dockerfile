# Clipper.ai operations backend — Express API + in-process pipeline/publish/
# metrics workers. Debian-based (not Alpine) so the apt ffmpeg ships with
# libass: caption burn-in (M3) needs the `ass` subtitle filter, which the
# slimmed Homebrew/Alpine ffmpeg builds omit.
#
# whisper.cpp (M1 offline ASR) is a real, opt-in build: pass
# `--build-arg INSTALL_WHISPER=true` to compile the CLI + fetch the tiny model.
# It is OFF by default so the default image builds without the ~75 MB model
# download and stays lean — the builtin ASR keeps the stack fully working with
# zero keys and zero network at runtime (smoke:transcribe SKIPs honestly when
# whisper is absent; it never fakes a transcript).
FROM node:22-bookworm-slim

WORKDIR /app

# Runtime media tools: ffmpeg + ffprobe (render/probe/loudness, with libass for
# captions) and yt-dlp (M4 platform-URL ingest; the live path is gated).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg yt-dlp ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Optional: compile whisper.cpp + fetch the tiny English model (opt-in).
ARG INSTALL_WHISPER=false
ARG WHISPER_MODEL_NAME=ggml-tiny.en.bin
RUN if [ "$INSTALL_WHISPER" = "true" ]; then \
      set -eux; \
      apt-get update; \
      apt-get install -y --no-install-recommends git cmake build-essential curl; \
      git clone --depth 1 https://github.com/ggml-org/whisper.cpp /tmp/whisper.cpp; \
      cmake -S /tmp/whisper.cpp -B /tmp/whisper.cpp/build \
        -DGGML_METAL=OFF -DWHISPER_BUILD_EXAMPLES=ON -DCMAKE_BUILD_TYPE=Release; \
      cmake --build /tmp/whisper.cpp/build -j --target whisper-cli; \
      cp /tmp/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli; \
      mkdir -p /opt/whisper; \
      curl -sL -o "/opt/whisper/${WHISPER_MODEL_NAME}" \
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${WHISPER_MODEL_NAME}"; \
      rm -rf /tmp/whisper.cpp /var/lib/apt/lists/*; \
    fi
# Wired regardless; only takes effect when TRANSCRIPTION_PROVIDER=whisper and the
# binary/model exist (built above). Harmless otherwise.
ENV WHISPER_BIN=whisper-cli \
    WHISPER_MODEL=/opt/whisper/ggml-tiny.en.bin

# Install dependencies against the lockfile first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8080
# server.js runs migrations on boot, then starts the API + workers in-process.
CMD ["node", "src/server.js"]
