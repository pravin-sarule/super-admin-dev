// const { DataTypes } = require('sequelize');
// const sequelize = require('../config/sequelize');

// const Template = sequelize.define('Template', {
//   id: {
//     type: DataTypes.INTEGER,
//     primaryKey: true,
//     autoIncrement: true,
//   },
//   name: {
//     type: DataTypes.STRING(255),
//     allowNull: false,
//   },
//   category: {
//     type: DataTypes.STRING(100),
//   },
//   type: {
//     type: DataTypes.STRING(100),
//   },
//   status: {
//     type: DataTypes.STRING(50),
//     defaultValue: 'active', // active | inactive | deprecated
//   },
//   gcs_path: {
//     type: DataTypes.TEXT,
//     allowNull: false,
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
//   tableName: 'templates',
//   timestamps: false, // Disable Sequelize's default timestamps as we have custom ones
// });

// module.exports = Template;



// const { DataTypes } = require('sequelize');
// const sequelize = require('../config/sequelize');

// const Template = sequelize.define('Template', {
//   id: {
//     type: DataTypes.UUID,           // Change to UUID
//     defaultValue: DataTypes.UUIDV4,  // Auto-generate UUID
//     primaryKey: true,
//   },
//   name: {
//     type: DataTypes.STRING(255),
//     allowNull: false,
//   },
//   category: {
//     type: DataTypes.STRING(100),
//   },
//   type: {
//     type: DataTypes.STRING(100),
//   },
//   status: {
//     type: DataTypes.STRING(50),
//     defaultValue: 'active',
//   },
//   gcs_path: {
//     type: DataTypes.TEXT,
//     allowNull: false,
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
//   tableName: 'templates',
//   timestamps: false,
// });

// module.exports = Template;
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Template = sequelize.define('Template', {
  id: {
    type: DataTypes.UUID,           // UUID primary key
    defaultValue: DataTypes.UUIDV4, // Auto-generate UUID
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING(100),
  },
  type: {
    type: DataTypes.STRING(100),
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'active', // active | inactive | deprecated
  },
  gcs_path: {
    type: DataTypes.TEXT,
    allowNull: false,
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
  tableName: 'templates',
  timestamps: false,
});

module.exports = Template;
