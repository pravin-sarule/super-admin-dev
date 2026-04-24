const { DataTypes } = require('sequelize');
const supportSequelize = require('../config/supportSequelize');

const SupportAdminProfile = supportSequelize.define(
  'SupportAdminProfile',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    manager_admin_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    team_name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: 'Support Team',
    },
    is_team_manager: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    can_manage_team: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    can_view_all_tickets: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    can_view_assigned_to_me: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    can_view_team_tickets: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    can_view_unassigned_tickets: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    can_view_closed_tickets: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    can_view_archived_tickets: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    default_queue: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'assigned_to_me',
    },
    allowed_priorities: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    allowed_categories: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    assignment_preferences: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    created_by_admin_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by_admin_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'support_admin_profiles',
    timestamps: false,
  }
);

module.exports = SupportAdminProfile;
