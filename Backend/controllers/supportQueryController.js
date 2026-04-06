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


const path = require('path');
const SupportQuery = require('../models/support_query');
const sendEmail = require('../utils/sendEmail');
const { getQueryStatusUpdateEmailTemplate } = require('../utils/emailTemplates');
const logger = require('../config/logger');
const { bucket } = require('../middleware/upload');

module.exports = (pool) => {
  const logSupportFlow = (level, message, meta = {}) => {
    logger[level](message, {
      layer: 'SUPPORT',
      ...meta,
    });
  };

  const getSupportSchemaSnapshot = async () => {
    try {
      const tableName =
        typeof SupportQuery.getTableName === 'function'
          ? SupportQuery.getTableName()
          : 'support_queries';
      const describedTable = await SupportQuery.sequelize.getQueryInterface().describeTable(tableName);

      return {
        tableName,
        columns: Object.keys(describedTable),
      };
    } catch (error) {
      return {
        schemaError: error.message,
      };
    }
  };

  const normalizeAttachmentPath = (attachmentUrl) => {
    const rawValue = String(attachmentUrl || '').trim();
    if (!rawValue) return '';

    if (/^https?:\/\//i.test(rawValue)) {
      return rawValue;
    }

    if (rawValue.startsWith('gs://')) {
      const withoutProtocol = rawValue.slice(5);
      const firstSlashIndex = withoutProtocol.indexOf('/');
      return firstSlashIndex >= 0 ? withoutProtocol.slice(firstSlashIndex + 1) : '';
    }

    return rawValue.replace(/^\/+/, '');
  };

  const collectAttachmentCandidates = (attachmentValue) => {
    if (attachmentValue == null) return [];

    if (Array.isArray(attachmentValue)) {
      return attachmentValue.flatMap((entry) => collectAttachmentCandidates(entry));
    }

    if (typeof attachmentValue === 'object') {
      const candidateValue =
        attachmentValue.attachment_url ||
        attachmentValue.url ||
        attachmentValue.path ||
        attachmentValue.gcsPath ||
        attachmentValue.gcs_path ||
        attachmentValue.file_path ||
        attachmentValue.storage_path ||
        attachmentValue.storagePath ||
        attachmentValue.gcsUrl ||
        attachmentValue.gcs_url ||
        attachmentValue.cloudStorageObject ||
        '';

      if (!candidateValue) return [];

      return [
        {
          value: candidateValue,
          file_name: attachmentValue.file_name || attachmentValue.fileName || attachmentValue.name || '',
          mime_type: attachmentValue.mime_type || attachmentValue.mimeType || '',
          size: attachmentValue.size || null,
        },
      ];
    }

    const rawText = String(attachmentValue).trim();
    if (!rawText) return [];

    if (
      (rawText.startsWith('[') && rawText.endsWith(']')) ||
      (rawText.startsWith('{') && rawText.endsWith('}'))
    ) {
      try {
        const parsedValue = JSON.parse(rawText);
        return collectAttachmentCandidates(parsedValue);
      } catch (error) {
        // Fall back to plain string parsing below.
      }
    }

    if (rawText.includes('\n')) {
      return rawText
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => ({ value: entry, file_name: '' }));
    }

    if (rawText.includes('|')) {
      return rawText
        .split('|')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => ({ value: entry, file_name: '' }));
    }

    if (rawText.includes(',')) {
      const commaSeparatedEntries = rawText
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

      if (commaSeparatedEntries.length > 1) {
        return commaSeparatedEntries.map((entry) => ({ value: entry, file_name: '' }));
      }
    }

    return [{ value: rawText, file_name: '' }];
  };

  const parseSupportAttachments = (attachmentValue) => {
    const candidates = collectAttachmentCandidates(attachmentValue);

    return candidates
      .map((entry, index) => {
        const rawValue = String(entry?.value || '').trim();
        if (!rawValue) return null;

        const normalizedPath = normalizeAttachmentPath(rawValue);
        if (!normalizedPath) return null;

        return {
          id: `attachment-${index}`,
          index,
          attachment_url: rawValue,
          normalized_path: normalizedPath,
          file_name: buildAttachmentFileName(entry.file_name || rawValue, `attachment-${index + 1}`),
          mime_type: entry.mime_type || '',
          size: entry.size || null,
          is_external: /^https?:\/\//i.test(normalizedPath),
        };
      })
      .filter(Boolean);
  };

  const buildAttachmentFileName = (attachmentReference, fallbackName) => {
    const derivedName = path.basename(String(attachmentReference || '').split('?')[0] || '');
    const sanitizedName = derivedName.replace(/["\r\n]/g, '').trim();
    return sanitizedName || fallbackName;
  };

  const resolveAttachmentUrl = async (attachmentUrl, meta = {}) => {
    const normalizedValue = normalizeAttachmentPath(attachmentUrl);
    if (!normalizedValue) return '';

    if (/^https?:\/\//i.test(normalizedValue)) {
      return normalizedValue;
    }

    try {
      const file = bucket.file(normalizedValue);
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000,
      });

      return signedUrl;
    } catch (error) {
      logSupportFlow('warn', 'Failed to generate signed URL for support attachment, falling back to public URL', {
        ...meta,
        bucketName: bucket?.name,
        attachmentUrl,
        normalizedAttachmentPath: normalizedValue,
        error: error.message,
      });

      if (bucket?.name) {
        return `https://storage.googleapis.com/${bucket.name}/${normalizedValue}`;
      }

      return normalizedValue;
    }
  };

  const formatSupportQuery = async (query, meta = {}) => {
    const plainQuery = typeof query?.toJSON === 'function' ? query.toJSON() : query;
    if (!plainQuery) return null;

    const attachmentSource = plainQuery.attachment_urls ?? null;
    const attachments = parseSupportAttachments(attachmentSource);
    const resolvedAttachmentUrl = attachments[0]
      ? await resolveAttachmentUrl(attachments[0].attachment_url, meta)
      : '';

    return {
      ...plainQuery,
      attachment_urls: plainQuery.attachment_urls ?? attachments,
      attachments,
      attachment_count: attachments.length,
      resolved_attachment_url: resolvedAttachmentUrl,
    };
  };

  const supportQueryController = {
    // Create a new support query
    createSupportQuery: async (req, res) => {
      try {
        const { user_id, subject, priority, message, attachment_urls, attachment_url } = req.body;
        logSupportFlow('info', 'Creating support query', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          targetUserId: user_id,
          subject,
          priority,
        });

        // Support both attachment_urls (JSON array) and legacy attachment_url (plain text)
        const resolvedAttachmentUrls = attachment_urls ?? (attachment_url ? [{ attachment_url }] : null);

        const newQuery = await SupportQuery.create({
          user_id,
          subject,
          priority,
          message,
          attachment_urls: resolvedAttachmentUrls,
        });
        const formattedQuery = await formatSupportQuery(newQuery, {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: newQuery.id,
        });

        logSupportFlow('info', 'Support query created', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: newQuery.id,
          targetUserId: newQuery.user_id,
          status: newQuery.status,
        });

        res.status(201).json(formattedQuery);
      } catch (error) {
        logSupportFlow('error', 'Error creating support query', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          error: error.message,
          stack: error.stack,
        });
        res.status(500).json({ message: 'Error creating support query', error: error.message });
      }
    },

    // Get all support queries (Admin only)
    getAllSupportQueries: async (req, res) => {
      try {
        logSupportFlow('info', 'Fetching all support queries', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          modelAttributes: Object.keys(SupportQuery.getAttributes()),
        });

        const queries = await SupportQuery.findAll({ order: [['created_at', 'DESC']] });
        const formattedQueries = await Promise.all(
          queries.map((query) =>
            formatSupportQuery(query, {
              requestId: req.requestId,
              actorId: req.user?.id,
              actorRole: req.user?.role,
              queryId: query.id,
            })
          )
        );

        logSupportFlow('info', 'Fetched support queries successfully', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          totalQueries: formattedQueries.length,
          queryIds: formattedQueries.map((query) => query.id),
          firstQueryPreview: formattedQueries[0]
            ? {
                id: formattedQueries[0].id,
                ticket_number: formattedQueries[0].ticket_number,
                subject: formattedQueries[0].subject,
                status: formattedQueries[0].status,
                user_id: formattedQueries[0].user_id,
                user_email: formattedQueries[0].user_email,
                user_name: formattedQueries[0].user_name,
                attachment_count: formattedQueries[0].attachment_count,
                resolved_attachment_url: formattedQueries[0].resolved_attachment_url,
              }
            : null,
        });

        res.status(200).json(formattedQueries);
      } catch (error) {
        const schemaSnapshot = await getSupportSchemaSnapshot();
        logSupportFlow('error', 'Error fetching all support queries', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          error: error.message,
          modelAttributes: Object.keys(SupportQuery.getAttributes()),
          schemaSnapshot,
          stack: error.stack,
        });
        res.status(500).json({ message: 'Error fetching support queries', error: error.message });
      }
    },

    // Get a single support query by ID
    getSupportQueryById: async (req, res) => {
      try {
        const { id } = req.params;

        logSupportFlow('info', 'Fetching support query by id', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: id,
        });

        const query = await SupportQuery.findByPk(id);
        if (!query) return res.status(404).json({ message: 'Support query not found' });
        const formattedQuery = await formatSupportQuery(query, {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: id,
        });

        logSupportFlow('info', 'Fetched support query by id successfully', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: id,
          status: query.status,
          priority: query.priority,
        });

        res.status(200).json(formattedQuery);
      } catch (error) {
        logSupportFlow('error', 'Error fetching support query by id', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: req.params?.id,
          error: error.message,
          stack: error.stack,
        });
        res.status(500).json({ message: 'Error fetching support query', error: error.message });
      }
    },

    // Get support queries by user ID
    getSupportQueriesByUserId: async (req, res) => {
      try {
        const { userId } = req.params;
        logSupportFlow('info', 'Fetching support queries by user id', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          targetUserId: userId,
        });

        const queries = await SupportQuery.findAll({
          where: { user_id: userId },
          order: [['created_at', 'DESC']],
        });
        const formattedQueries = await Promise.all(
          queries.map((query) =>
            formatSupportQuery(query, {
              requestId: req.requestId,
              actorId: req.user?.id,
              actorRole: req.user?.role,
              queryId: query.id,
            })
          )
        );

        logSupportFlow('info', 'Fetched support queries by user id successfully', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          targetUserId: userId,
          totalQueries: formattedQueries.length,
        });

        res.status(200).json(formattedQueries);
      } catch (error) {
        logSupportFlow('error', 'Error fetching support queries by user id', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          targetUserId: req.params?.userId,
          error: error.message,
          stack: error.stack,
        });
        res.status(500).json({ message: 'Error fetching user support queries', error: error.message });
      }
    },

    previewSupportQueryAttachment: async (req, res) => {
      try {
        const { id } = req.params;
        const attachmentIndex = Number.parseInt(req.query.attachmentIndex ?? '0', 10);
        logSupportFlow('info', 'Preparing support query attachment preview', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: id,
          attachmentIndex,
        });

        const query = await SupportQuery.findByPk(id);
        if (!query) {
          return res.status(404).json({ message: 'Support query not found' });
        }

        const attachmentSource = query.attachment_urls ?? null;
        const attachments = parseSupportAttachments(attachmentSource);
        const selectedAttachment = attachments[attachmentIndex];

        if (!selectedAttachment) {
          return res.status(404).json({ message: 'No attachment was found for this support query.' });
        }

        const normalizedAttachmentPath = selectedAttachment.normalized_path;

        if (/^https?:\/\//i.test(normalizedAttachmentPath)) {
          const upstreamResponse = await fetch(normalizedAttachmentPath);
          if (!upstreamResponse.ok) {
            logSupportFlow('warn', 'Support attachment preview upstream request failed', {
              requestId: req.requestId,
              actorId: req.user?.id,
              actorRole: req.user?.role,
              queryId: id,
              attachmentIndex,
              normalizedAttachmentPath,
              upstreamStatus: upstreamResponse.status,
            });
            return res.status(upstreamResponse.status).json({
              message: 'Attachment preview could not be loaded from the upstream source.',
            });
          }

          const arrayBuffer = await upstreamResponse.arrayBuffer();
          const contentType = upstreamResponse.headers.get('content-type') || 'application/octet-stream';
          const fileName = buildAttachmentFileName(
            selectedAttachment.file_name || normalizedAttachmentPath,
            `support-query-${id}-attachment`
          );

          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
          res.setHeader('Cache-Control', 'private, max-age=300');

          logSupportFlow('info', 'Support attachment preview streamed from upstream URL', {
            requestId: req.requestId,
            actorId: req.user?.id,
            actorRole: req.user?.role,
            queryId: id,
            attachmentIndex,
            contentType,
            fileName,
          });

          return res.status(200).send(Buffer.from(arrayBuffer));
        }

        const file = bucket.file(normalizedAttachmentPath);
        const [metadata] = await file.getMetadata();
        const [buffer] = await file.download();
        const contentType = metadata?.contentType || 'application/octet-stream';
        const fileName = buildAttachmentFileName(
          selectedAttachment.file_name || normalizedAttachmentPath,
          `support-query-${id}-attachment`
        );

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.setHeader('Content-Length', buffer.length);

        logSupportFlow('info', 'Support attachment preview streamed from storage', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: id,
          attachmentIndex,
          totalAttachments: attachments.length,
          bucketName: bucket?.name,
          normalizedAttachmentPath,
          contentType,
          fileName,
          fileSize: buffer.length,
        });

        return res.status(200).send(buffer);
      } catch (error) {
        const message =
          error.code === 404
            ? 'The attachment file could not be found in storage.'
            : error.code === 403 || /storage\.objects\.get|access denied/i.test(error.message)
              ? 'Attachment preview is unavailable because the configured storage service account does not have permission to read this file.'
              : 'Attachment preview could not be loaded.';
        const statusCode =
          error.code === 404
            ? 404
            : error.code === 403 || /storage\.objects\.get|access denied/i.test(error.message)
              ? 403
              : 500;

        logSupportFlow('error', 'Error preparing support query attachment preview', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: req.params?.id,
          attachmentIndex: req.query?.attachmentIndex,
          bucketName: bucket?.name,
          error: error.message,
          code: error.code,
          stack: error.stack,
        });

        return res.status(statusCode).json({
          message,
          error: error.message,
        });
      }
    },

    // Update a support query by ID
    updateSupportQuery: async (req, res) => {
      try {
        const { id } = req.params;
        const { subject, priority, message, attachment_urls, attachment_url, status, admin_message } = req.body;

        logSupportFlow('info', 'Updating support query', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: id,
          nextStatus: status,
          nextPriority: priority,
        });

        const queryToUpdate = await SupportQuery.findByPk(id);
        if (!queryToUpdate) return res.status(404).json({ message: 'Support query not found' });

        const oldStatus = String(queryToUpdate.status ?? '').trim().toLowerCase();

        // Normalise the incoming status so the DB always stores lowercase
        const normalizedStatus = status ? String(status).trim().toLowerCase() : undefined;

        // Support both attachment_urls (JSON) and legacy attachment_url (plain text)
        const resolvedAttachmentUrls =
          attachment_urls !== undefined
            ? attachment_urls
            : attachment_url !== undefined
              ? [{ attachment_url }]
              : undefined;

        // Update only the provided fields
        await queryToUpdate.update({
          subject: subject ?? queryToUpdate.subject,
          priority: priority ?? queryToUpdate.priority,
          message: message ?? queryToUpdate.message,
          ...(resolvedAttachmentUrls !== undefined && { attachment_urls: resolvedAttachmentUrls }),
          status: normalizedStatus ?? queryToUpdate.status,
          updated_at: new Date(),
        });

        // Reload updated query
        const updatedQuery = await SupportQuery.findByPk(id);
        const formattedUpdatedQuery = await formatSupportQuery(updatedQuery, {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: id,
        });

        const newStatus = String(updatedQuery.status ?? '').trim().toLowerCase();

        // Send email when the status has changed OR an admin message (status note) is provided
        const hasAdminMessage = admin_message && String(admin_message).trim().length > 0;
        const statusDidChange = normalizedStatus !== undefined && oldStatus !== newStatus;

        let recipientEmail = null;
        let recipientName = 'User';

        if (statusDidChange || hasAdminMessage) {
          let user = null;

          if (updatedQuery.user_id) {
            const userResult = await pool.query(
              'SELECT email, username FROM users WHERE id = $1',
              [updatedQuery.user_id]
            );
            user = userResult.rows[0] || null;
          }

          recipientEmail = user?.email || updatedQuery.user_email || null;
          recipientName = user?.username || updatedQuery.user_name || updatedQuery.user_email || 'User';
          const queryReference = updatedQuery.ticket_number || `SUP-${updatedQuery.id}`;

          if (recipientEmail) {
            const emailHtml = getQueryStatusUpdateEmailTemplate(
              recipientName,
              updatedQuery.subject,
              updatedQuery.status,
              admin_message || '',
              queryReference
            );

            try {
              await sendEmail({
                email: recipientEmail,
                subject: `Support Query ${queryReference} Updated to ${updatedQuery.status}`,
                html: emailHtml,
                text: `Dear ${recipientName},\n\nThe status of your support query (${queryReference} - ${updatedQuery.subject}) has been updated to ${updatedQuery.status}.\n\nAdmin Message: ${admin_message || 'No message provided'}\n\nSincerely,\nNexintel Support Team`,
              });
              logSupportFlow('info', 'Support query status email sent', {
                requestId: req.requestId,
                actorId: req.user?.id,
                actorRole: req.user?.role,
                queryId: updatedQuery.id,
                recipientEmail,
                previousStatus: oldStatus,
                nextStatus: updatedQuery.status,
                queryReference,
              });
            } catch (emailError) {
              logSupportFlow('error', 'Error sending support query status email', {
                requestId: req.requestId,
                actorId: req.user?.id,
                actorRole: req.user?.role,
                queryId: updatedQuery.id,
                recipientEmail,
                error: emailError.message,
                stack: emailError.stack,
              });
            }
          } else {
            logSupportFlow('warn', 'Skipped support query status email because no recipient email was available', {
              requestId: req.requestId,
              actorId: req.user?.id,
              actorRole: req.user?.role,
              queryId: updatedQuery.id,
              previousStatus: oldStatus,
              nextStatus: updatedQuery.status,
            });
          }
        }

        logSupportFlow('info', 'Support query updated successfully', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: updatedQuery.id,
          previousStatus: oldStatus,
          nextStatus: newStatus,
          statusChanged: statusDidChange,
          priority: updatedQuery.priority,
        });

        const emailSent = Boolean((statusDidChange || hasAdminMessage) && recipientEmail);

        res.status(200).json({
          ...formattedUpdatedQuery,
          status_changed: statusDidChange,
          email_sent: emailSent,
        });
      } catch (error) {
        logSupportFlow('error', 'Error updating support query', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: req.params?.id,
          error: error.message,
          stack: error.stack,
        });
        res.status(500).json({ message: 'Error updating support query', error: error.message });
      }
    },

    // Delete a support query by ID
    deleteSupportQuery: async (req, res) => {
      try {
        const { id } = req.params;
        logSupportFlow('info', 'Deleting support query', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: id,
        });

        const deletedRowCount = await SupportQuery.destroy({ where: { id } });
        if (deletedRowCount === 0) return res.status(404).json({ message: 'Support query not found' });

        logSupportFlow('info', 'Support query deleted successfully', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: id,
        });

        res.status(204).send();
      } catch (error) {
        logSupportFlow('error', 'Error deleting support query', {
          requestId: req.requestId,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          queryId: req.params?.id,
          error: error.message,
          stack: error.stack,
        });
        res.status(500).json({ message: 'Error deleting support query', error: error.message });
      }
    },
  };

  return supportQueryController;
};
