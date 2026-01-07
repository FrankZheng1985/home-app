# 使用官方 Node.js 轻量级镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 设置时区为上海
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 复制依赖文件 (调整路径：从 server 目录复制)
COPY server/package*.json ./

# 安装生产环境依赖
RUN npm install --production

# 复制源代码 (调整路径：复制 server 目录下的所有文件)
COPY server/ .

# 暴露端口 (微信云托管默认使用 80 端口)
EXPOSE 80

# 启动命令
CMD ["npm", "start"]
