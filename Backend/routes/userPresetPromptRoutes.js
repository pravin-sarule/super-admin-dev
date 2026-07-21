// routes/userPresetPromptRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getUserDirectory,
  getUsersWithPresetPrompts,
  getPresetPromptsByUser,
  createGroupForUser,
  createPromptForUser,
  deletePrompt,
  deleteGroup,
} = require('../controllers/userPresetPromptController');

// These routes read and write ANOTHER user's prompts, so they are super-admin only —
// unlike the document service's own endpoints, which scope to the caller's own JWT user_id.
module.exports = (pool) => {
  const admin = [protect(pool), authorize(['super-admin'])];

  // Static path first so it is not swallowed by /users/:userId.
  router.get('/directory', ...admin, getUserDirectory);

  router.get('/users', ...admin, getUsersWithPresetPrompts);
  router.get('/users/:userId', ...admin, getPresetPromptsByUser);

  router.post('/users/:userId/groups', ...admin, createGroupForUser);
  router.post('/users/:userId/prompts', ...admin, createPromptForUser);

  router.delete('/prompts/:promptId', ...admin, deletePrompt);
  router.delete('/groups/:groupId', ...admin, deleteGroup);

  return router;
};
