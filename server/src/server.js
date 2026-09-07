require('dotenv').config();

const express = require('express');
const multer = require('multer');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');
const friendsRoutes = require('./routes/friends.routes');
const conversationRoutes = require('./routes/conversations.routes');
const { attachSocket } = require('./socket');

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'shno-mano-tech-api'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendsRoutes.router);
app.use('/api/conversations', conversationRoutes);
app.use('/uploads', express.static(require('path').resolve(__dirname, '../../uploads')));

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'حجم الملف أكبر من الحد المسموح' : 'نوع أو عدد الملفات غير مسموح' });
  }
  if (error) return res.status(500).json({ ok: false, message: 'حدث خطأ في الخادم' });
  next();
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: 'المسار غير موجود'
  });
});

const port = Number(process.env.PORT || 3000);

connectDB()
  .then(() => {
    attachSocket(httpServer);
    httpServer.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch(error => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  });
