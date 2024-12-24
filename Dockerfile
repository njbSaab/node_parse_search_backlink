# Используем базовый образ Node.js
FROM node:18

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все файлы проекта в контейнер
COPY . .

# Указываем порт, который будет слушать контейнер
EXPOSE 3030

# Запускаем приложение
CMD ["node", "index.js"]