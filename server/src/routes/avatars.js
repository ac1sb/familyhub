import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { uploadsDir } from '../lib/paths.js';
import { getMemberAvatars, setMemberAvatar } from '../lib/appConfig.js';

const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const MEMBERS = new Set(['member_1', 'member_2', 'member_3']);

const router = Router();

function requireMember(req, res, next) {
  if (!MEMBERS.has(req.params.member)) return res.status(400).json({ error: 'member must be member_1, member_2, or member_3' });
  next();
}

function deleteOldPhoto(oldPhoto) {
  if (!oldPhoto) return;
  fs.unlink(path.join(uploadsDir, oldPhoto.replace(/^\/uploads\//, '')), () => {});
}

router.get('/', (req, res) => {
  res.json(getMemberAvatars());
});

router.put('/:member/color', requireMember, (req, res) => {
  const { color } = req.body;
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) {
    return res.status(400).json({ error: 'color must be a hex string like #aabbcc' });
  }
  res.json(setMemberAvatar(req.params.member, { color }));
});

router.post('/:member/photo', requireMember, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'photo file is required' });

  const ext = path.extname(req.file.originalname || '') || '.png';
  const filename = `${req.params.member}-${Date.now()}${ext}`;
  fs.writeFileSync(path.join(avatarsDir, filename), req.file.buffer);

  // Only one photo per member is ever kept - remove the previous one so
  // re-uploading doesn't quietly fill the disk with old copies.
  deleteOldPhoto(getMemberAvatars()[req.params.member].photo);

  res.json(setMemberAvatar(req.params.member, { photo: `/uploads/avatars/${filename}` }));
});

router.delete('/:member/photo', requireMember, (req, res) => {
  deleteOldPhoto(getMemberAvatars()[req.params.member].photo);
  res.json(setMemberAvatar(req.params.member, { photo: null }));
});

export default router;
