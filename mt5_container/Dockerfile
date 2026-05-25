# Multi-stage build for MetaTrader 5 Wine Container
FROM debian:bookworm-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV WINEPREFIX=/opt/wineprefix
ENV WINEARCH=win64
ENV DISPLAY=:1
ENV WINEDEBUG=-all

# Install Wine, Xvfb, VNC, and utilities
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        gnupg2 \
        software-properties-common \
        unzip \
        xvfb \
        x11vnc \
        fluxbox \
        supervisor \
        python3 \
        python3-pip && \
    # Install WineHQ
    mkdir -pm755 /etc/apt/keyrings && \
    curl -fsSL https://dl.winehq.org/wine-builds/winehq.key -o /etc/apt/keyrings/winehq-archive.key && \
    curl -fsSL https://dl.winehq.org/wine-builds/debian/dists/bookworm/winehq-bookworm.sources -o /etc/apt/sources.list.d/winehq-bookworm.sources && \
    apt-get update && \
    apt-get install -y --install-recommends winehq-stable && \
    # Clean up
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install winetricks to install core fonts and dlls if needed
RUN curl -fsSL https://raw.githubusercontent.com/Winetricks/winetricks/master/src/winetricks -o /usr/local/bin/winetricks && \
    chmod +x /usr/local/bin/winetricks

# Create non-root user for Wine execution
RUN useradd -m -s /bin/bash trader && \
    mkdir -p /opt/wineprefix && \
    chown -R trader:trader /opt/wineprefix

USER trader
WORKDIR /home/trader

# Initialize WinePrefix and download MT5 installer
RUN wineboot --init && \
    curl -fsSL "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe" -o mt5setup.exe

# Install Python for Windows using the Embeddable Zip and setup pip
RUN mkdir -p /opt/wineprefix/drive_c/Python310 && \
    curl -fsSL "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip" -o python-embed.zip && \
    unzip python-embed.zip -d /opt/wineprefix/drive_c/Python310 && \
    rm python-embed.zip && \
    sed -i 's/#import site/import site/' /opt/wineprefix/drive_c/Python310/python310._pth && \
    curl -fsSL "https://bootstrap.pypa.io/get-pip.py" -o get-pip.py && \
    wine C:\\Python310\\python.exe get-pip.py && \
    rm get-pip.py

# Install dependencies inside Wine Python
RUN wine C:\\Python310\\python.exe -m pip install MetaTrader5 grpcio grpcio-tools

COPY --chown=trader:trader app/ /home/trader/app/
COPY --chown=trader:trader supervisor.conf /home/trader/supervisor.conf
COPY --chown=trader:trader entrypoint.sh /home/trader/entrypoint.sh
RUN chmod +x /home/trader/entrypoint.sh

EXPOSE 50051 5900 8080
ENTRYPOINT ["/home/trader/entrypoint.sh"]
