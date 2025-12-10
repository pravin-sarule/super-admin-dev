// const { DataTypes } = require('sequelize');
// const sequelize = require('../config/sequelize');

// const SupportQuery = sequelize.define('SupportQuery', {
//   id: {
//     type: DataTypes.INTEGER,
//     primaryKey: true,
//     autoIncrement: true,
//   },
//   user_id: {
//     type: DataTypes.INTEGER,
//     allowNull: true,
//     // references: {
//     //   model: 'users', // Assumes a 'users' table exists
//     //   key: 'id',
//     // },
//   },
//   subject: {
//     type: DataTypes.STRING(100),
//     allowNull: false,
//   },
//   priority: {
//     type: DataTypes.STRING(20),
//     allowNull: false,
//   },
//   message: {
//     type: DataTypes.TEXT,
//     allowNull: false,
//   },
//   attachment_url: {
//     type: DataTypes.TEXT,
//   },
//   status: {
//     type: DataTypes.STRING(20),
//     defaultValue: 'open', // open, in_progress, resolved, closed
//   },
//   created_at: {
//     type: DataTypes.DATE,
//     defaultValue: DataTypes.NOW,
//   },
//   updated_at: {
//     type: DataTypes.DATE,
//     defaultValue: DataTypes.NOW,
//   },
// }, {
//   tableName: 'support_queries',
//   timestamps: false, // Disable Sequelize's default timestamps as we have custom ones
// });

// module.exports = SupportQuery;

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const SupportQuery = sequelize.define('SupportQuery', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,  // enforce NOT NULL
    references: {
      model: 'users', // must match your Users table name
      key: 'id',
    },
    onDelete: 'CASCADE',  // enforce ON DELETE CASCADE
  },
  subject: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  priority: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  attachment_url: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'open', // open, in_progress, resolved, closed
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
  tableName: 'support_queries',
  timestamps: false, // keeping false since you manage created_at/updated_at manually
});

module.exports = SupportQuery;
