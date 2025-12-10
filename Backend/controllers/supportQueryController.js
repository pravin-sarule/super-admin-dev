// const SupportQuery = require('../models/support_query');
// const sendEmail = require('../utils/sendEmail');
// const { getQueryStatusUpdateEmailTemplate } = require('../utils/emailTemplates');

// module.exports = (pool) => { // Accept pool as an argument
//   const supportQueryController = {
//     // Create a new support query
//     createSupportQuery: async (req, res) => {
//       try {
//         const { user_id, subject, priority, message, attachment_url } = req.body;
//         const newQuery = await SupportQuery.create({
//           user_id,
//           subject,
//           priority,
//           message,
//           attachment_url,
//         });
//         res.status(201).json(newQuery);
//       } catch (error) {
//         console.error('Error creating support query:', error);
//         res.status(500).json({ message: 'Error creating support query', error: error.message });
//       }
//     },

//     // Get all support queries (Admin only)
//     getAllSupportQueries: async (req, res) => {
//       try {
//         const queries = await SupportQuery.findAll();
//         res.status(200).json(queries);
//       } catch (error) {
//         console.error('Error fetching all support queries:', error);
//         res.status(500).json({ message: 'Error fetching support queries', error: error.message });
//       }
//     },

//     // Get a single support query by ID
//     getSupportQueryById: async (req, res) => {
//       try {
//         const { id } = req.params;
//         const query = await SupportQuery.findByPk(id);
//         if (!query) {
//           return res.status(404).json({ message: 'Support query not found' });
//         }
//         res.status(200).json(query);
//       } catch (error) {
//         console.error('Error fetching support query by ID:', error);
//         res.status(500).json({ message: 'Error fetching support query', error: error.message });
//       }
//     },

//     // Get support queries by user ID
//     getSupportQueriesByUserId: async (req, res) => {
//       try {
//         const { userId } = req.params;
//         const queries = await SupportQuery.findAll({
//           where: { user_id: userId },
//           order: [['created_at', 'DESC']],
//         });
//         res.status(200).json(queries);
//       } catch (error) {
//         console.error('Error fetching support queries by user ID:', error);
//         res.status(500).json({ message: 'Error fetching user support queries', error: error.message });
//       }
//     },

//     // Update a support query by ID
//     updateSupportQuery: async (req, res) => {
//       try {
//         const { id } = req.params;
//         const { subject, priority, message, attachment_url, status, admin_message } = req.body; // Added admin_message

//         const queryToUpdate = await SupportQuery.findByPk(id);
//         if (!queryToUpdate) {
//           return res.status(404).json({ message: 'Support query not found' });
//         }

//         const oldStatus = queryToUpdate.status;

//         const [updatedRows] = await SupportQuery.update(
//           { subject, priority, message, attachment_url, status, updated_at: new Date() },
//           {
//             where: { id },
//           }
//         );

//         if (updatedRows === 0) {
//           return res.status(400).json({ message: 'No changes made to support query' });
//         }

//         const updatedQuery = await SupportQuery.findByPk(id);

//         // Send email if status has changed and admin_message is provided
//         if (oldStatus !== updatedQuery.status && admin_message) {
//           const userResult = await pool.query('SELECT email, username FROM users WHERE id = $1', [updatedQuery.user_id]);
//           const user = userResult.rows[0];

//           if (user) {
//             const emailHtml = getQueryStatusUpdateEmailTemplate(
//               user.username || user.email, // Use username if available, else email
//               updatedQuery.subject,
//               updatedQuery.status,
//               admin_message
//             );

//             try {
//               await sendEmail({
//                 email: user.email,
//                 subject: `Your Support Query #${updatedQuery.id} Status Updated to ${updatedQuery.status}`,
//                 html: emailHtml,
//                 text: `Dear ${user.username || user.email},\n\nThe status of your support query (Subject: ${updatedQuery.subject}) has been updated to ${updatedQuery.status}.\n\nAdmin Message: ${admin_message}\n\nSincerely,\nNexintel Support Team`,
//               });
//               console.log(`Email sent to ${user.email} for query ${updatedQuery.id}`);
//               console.log(`Support query ID ${updatedQuery.id} status updated to ${updatedQuery.status} and email sent to ${user.email}`);
//             } catch (emailError) {
//               console.error('Error sending email:', emailError);
//               // Do not block the API response for email sending failure
//             }
//           }
//         }

//       res.status(200).json(updatedQuery);
//     } catch (error) {
//       console.error('Error updating support query:', error);
//       res.status(500).json({ message: 'Error updating support query', error: error.message });
//     }
//   },

//     // Delete a support query by ID
//     deleteSupportQuery: async (req, res) => {
//       try {
//         const { id } = req.params;
//         const deletedRowCount = await SupportQuery.destroy({
//           where: { id },
//         });
//         if (deletedRowCount === 0) {
//           return res.status(404).json({ message: 'Support query not found' });
//         }
//         res.status(204).send(); // No content to send back
//       } catch (error) {
//         console.error('Error deleting support query:', error);
//         res.status(500).json({ message: 'Error deleting support query', error: error.message });
//       }
//     },
//   };

//   return supportQueryController;
// };


const SupportQuery = require('../models/support_query');
const sendEmail = require('../utils/sendEmail');
const { getQueryStatusUpdateEmailTemplate } = require('../utils/emailTemplates');

module.exports = (pool) => {
  const supportQueryController = {
    // Create a new support query
    createSupportQuery: async (req, res) => {
      try {
        const { user_id, subject, priority, message, attachment_url } = req.body;
        const newQuery = await SupportQuery.create({
          user_id,
          subject,
          priority,
          message,
          attachment_url,
        });
        res.status(201).json(newQuery);
      } catch (error) {
        console.error('Error creating support query:', error);
        res.status(500).json({ message: 'Error creating support query', error: error.message });
      }
    },

    // Get all support queries (Admin only)
    getAllSupportQueries: async (req, res) => {
      try {
        const queries = await SupportQuery.findAll({ order: [['created_at', 'DESC']] });
        res.status(200).json(queries);
      } catch (error) {
        console.error('Error fetching all support queries:', error);
        res.status(500).json({ message: 'Error fetching support queries', error: error.message });
      }
    },

    // Get a single support query by ID
    getSupportQueryById: async (req, res) => {
      try {
        const { id } = req.params;
        const query = await SupportQuery.findByPk(id);
        if (!query) return res.status(404).json({ message: 'Support query not found' });
        res.status(200).json(query);
      } catch (error) {
        console.error('Error fetching support query by ID:', error);
        res.status(500).json({ message: 'Error fetching support query', error: error.message });
      }
    },

    // Get support queries by user ID
    getSupportQueriesByUserId: async (req, res) => {
      try {
        const { userId } = req.params;
        const queries = await SupportQuery.findAll({
          where: { user_id: userId },
          order: [['created_at', 'DESC']],
        });
        res.status(200).json(queries);
      } catch (error) {
        console.error('Error fetching support queries by user ID:', error);
        res.status(500).json({ message: 'Error fetching user support queries', error: error.message });
      }
    },

    // Update a support query by ID
    updateSupportQuery: async (req, res) => {
      try {
        const { id } = req.params;
        const { subject, priority, message, attachment_url, status, admin_message } = req.body;

        const queryToUpdate = await SupportQuery.findByPk(id);
        if (!queryToUpdate) return res.status(404).json({ message: 'Support query not found' });

        const oldStatus = queryToUpdate.status;

        // Update only the provided fields
        await queryToUpdate.update({
          subject: subject ?? queryToUpdate.subject,
          priority: priority ?? queryToUpdate.priority,
          message: message ?? queryToUpdate.message,
          attachment_url: attachment_url ?? queryToUpdate.attachment_url,
          status: status ?? queryToUpdate.status,
          updated_at: new Date(),
        });

        // Reload updated query
        const updatedQuery = await SupportQuery.findByPk(id);

        // Send email only if status changed and user_id exists
        if (oldStatus !== updatedQuery.status && updatedQuery.user_id) {
          const userResult = await pool.query(
            'SELECT email, username FROM users WHERE id = $1',
            [updatedQuery.user_id]
          );
          const user = userResult.rows[0];

          if (user) {
            const emailHtml = getQueryStatusUpdateEmailTemplate(
              user.username || user.email,
              updatedQuery.subject,
              updatedQuery.status,
              admin_message || ''
            );

            try {
              await sendEmail({
                email: user.email,
                subject: `Your Support Query #${updatedQuery.id} Status Updated to ${updatedQuery.status}`,
                html: emailHtml,
                text: `Dear ${user.username || user.email},\n\nThe status of your support query (Subject: ${updatedQuery.subject}) has been updated to ${updatedQuery.status}.\n\nAdmin Message: ${admin_message || 'No message provided'}\n\nSincerely,\nNexintel Support Team`,
              });
              console.log(`Email sent to ${user.email} for query ${updatedQuery.id}`);
            } catch (emailError) {
              console.error('Error sending email:', emailError);
            }
          }
        }

        res.status(200).json(updatedQuery);
      } catch (error) {
        console.error('Error updating support query:', error);
        res.status(500).json({ message: 'Error updating support query', error: error.message });
      }
    },

    // Delete a support query by ID
    deleteSupportQuery: async (req, res) => {
      try {
        const { id } = req.params;
        const deletedRowCount = await SupportQuery.destroy({ where: { id } });
        if (deletedRowCount === 0) return res.status(404).json({ message: 'Support query not found' });
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting support query:', error);
        res.status(500).json({ message: 'Error deleting support query', error: error.message });
      }
    },
  };

  return supportQueryController;
};
