const { DataTypes } = require('sequelize');
const supportSequelize = require('../config/supportSequelize');

const SupportPriority = supportSequelize.define('SupportPriority', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  value: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  label: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  color: {
    type: DataTypes.STRING(200),
    allowNull: false,
    defaultValue: 'bg-slate-100 text-slate-600 border-slate-200',
    comment: 'Tailwind CSS classes used for the priority badge',
  },
  display_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'support_priorities',
  timestamps: false,
});

module.exports = SupportPriority;
