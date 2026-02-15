FROM node:18-bullseye

# 1. Instalar dependencias base, agregar repositorio oficial de Docker e instalar CLI
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    jq \
    default-mysql-client \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update && apt-get install -y docker-ce-cli docker-compose-plugin

WORKDIR /app

# 2. Instalar dependencias de Node.js
COPY package*.json ./
RUN npm install

# 3. Copiar el resto del código
COPY . .

# 4. Asegurar permisos para los scripts
RUN chmod +x /app/*.sh

EXPOSE 3000

CMD ["node", "app.js"]