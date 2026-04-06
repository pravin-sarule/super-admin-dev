const SupportPriority = require('../models/support_priority');
const logger = require('../config/logger');

const log = (level, message, meta = {}) =>
  logger[level](message, { layer: 'SUPPORT_PRIORITY', ...meta });

const supportPriorityController = {
  // GET /api/support-priorities — all active priorities ordered by display_order
  getAllPriorities: async (req, res) => {
    try {
      const priorities = await SupportPriority.findAll({
        order: [['display_order', 'ASC'], ['id', 'ASC']],
      });
      res.status(200).json(priorities);
    } catch (error) {
      log('error', 'Error fetching priorities', { error: error.message });
      res.status(500).json({ message: 'Error fetching priorities', error: error.message });
    }
  },

  // POST /api/support-priorities — create a new priority
  createPriority: async (req, res) => {
    try {
      const { value, label, color, display_order, is_active } = req.body;

      if (!value || !label) {
        return res.status(400).json({ message: 'value and label are required' });
      }

      const priority = await SupportPriority.create({
        value: value.toLowerCase().trim(),
        label: label.trim(),
        color: color || 'bg-slate-100 text-slate-600 border-slate-200',
        display_order: display_order ?? 0,
        is_active: is_active !== undefined ? is_active : true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      log('info', 'Priority created', { priorityId: priority.id, value: priority.value });
      res.status(201).json(priority);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: `Priority with value "${req.body.value}" already exists` });
      }
      log('error', 'Error creating priority', { error: error.message });
      res.status(500).json({ message: 'Error creating priority', error: error.message });
    }
  },

  // PUT /api/support-priorities/:id — update a priority
  updatePriority: async (req, res) => {
    try {
      const { id } = req.params;
      const { value, label, color, display_order, is_active } = req.body;

      const priority = await SupportPriority.findByPk(id);
      if (!priority) {
        return res.status(404).json({ message: 'Priority not found' });
      }

      await priority.update({
        value: value !== undefined ? value.toLowerCase().trim() : priority.value,
        label: label !== undefined ? label.trim() : priority.label,
        color: color !== undefined ? color : priority.color,
        display_order: display_order !== undefined ? display_order : priority.display_order,
        is_active: is_active !== undefined ? is_active : priority.is_active,
        updated_at: new Date(),
      });

      log('info', 'Priority updated', { priorityId: id });
      res.status(200).json(priority);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: `Priority with value "${req.body.value}" already exists` });
      }
      log('error', 'Error updating priority', { priorityId: req.params.id, error: error.message });
      res.status(500).json({ message: 'Error updating priority', error: error.message });
    }
  },

  // DELETE /api/support-priorities/:id — delete a priority
  deletePriority: async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await SupportPriority.destroy({ where: { id } });
      if (!deleted) {
        return res.status(404).json({ message: 'Priority not found' });
      }
      log('info', 'Priority deleted', { priorityId: id });
      res.status(204).send();
    } catch (error) {
      log('error', 'Error deleting priority', { priorityId: req.params.id, error: error.message });
      res.status(500).json({ message: 'Error deleting priority', error: error.message });
    }
  },

  // PATCH /api/support-priorities/:id/toggle — toggle is_active
  togglePriority: async (req, res) => {
    try {
      const { id } = req.params;
      const priority = await SupportPriority.findByPk(id);
      if (!priority) {
        return res.status(404).json({ message: 'Priority not found' });
      }
      await priority.update({ is_active: !priority.is_active, updated_at: new Date() });
      log('info', 'Priority toggled', { priorityId: id, is_active: priority.is_active });
      res.status(200).json(priority);
    } catch (error) {
      log('error', 'Error toggling priority', { priorityId: req.params.id, error: error.message });
      res.status(500).json({ message: 'Error toggling priority', error: error.message });
    }
  },
};

module.exports = supportPriorityController;
