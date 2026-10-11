/**
 * Firestore creation triggers that apply the company's routing rules to new cases.
 * One per case collection; the routing itself lives in services/caseRouting.js.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const { routeCase } = require('../services/caseRouting');

if (!admin.apps.length) {
  admin.initializeApp();
}

const make = (path, caseType) =>
  onDocumentCreated(path, async (event) => {
    const snap = event.data;
    if (!snap) return;
    try {
      const result = await routeCase(admin.firestore(), caseType, event.params.caseId, snap.data());
      if (result.routed) logger.info('caseRouting: assigned', { caseType, ruleId: result.ruleId });
    } catch (error) {
      // Never throw: a retry could not improve on "no auto-assignment", the case stays unassigned.
      logger.error('caseRouting: failed', { caseType, code: error && error.code });
    }
  });

exports.routeNewPost = make('posts/{caseId}', 'post');
exports.routeNewVendorReport = make('vendorReports/{caseId}', 'vendor');
exports.routeNewContentReport = make('contentReports/{caseId}', 'moderation');
