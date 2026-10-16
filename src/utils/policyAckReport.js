// Pure helpers behind the "who has / hasn't acknowledged" table. No imports, so they can be
// unit tested from functions/test.

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  return new Date(value).getTime() || 0;
};

/**
 * Versions that have any response, newest activity first, always including the current one.
 */
export const listVersions = (responses, currentVersion) => {
  const latest = new Map();
  responses.forEach((r) => {
    const ms = toMillis(r.createdAt);
    if (ms >= (latest.get(r.policyVersion) ?? -1)) latest.set(r.policyVersion, ms);
  });
  if (currentVersion) latest.set(currentVersion, Number.MAX_SAFE_INTEGER);
  return [...latest.entries()].sort((a, b) => b[1] - a[1]).map(([version]) => version);
};

/**
 * Merge the roster (may be empty) with the responses to one policy version.
 *
 * Row status: "acknowledged" wins over everything; otherwise "concern" when the employee
 * raised one; otherwise "pending" (roster members only). `concerns` counts concerns either
 * way, so an acknowledged employee who also raised one stays visible.
 *
 * @param {{roster: Array<{employeeKey: string, employeeId: string, name?: string}>,
 *          responses: Array<object>, version: string}} input
 */
export const buildAckReport = ({ roster = [], responses = [], version }) => {
  const rows = new Map();
  const ensure = (employeeKey, employeeId, name, onRoster) => {
    if (!rows.has(employeeKey)) {
      rows.set(employeeKey, {
        employeeKey,
        employeeId,
        name: name || "",
        onRoster,
        status: "pending",
        acknowledgedAt: 0,
        concerns: 0,
        postIds: [],
      });
    }
    return rows.get(employeeKey);
  };

  roster.forEach((e) => ensure(e.employeeKey, e.employeeId, e.name, true));

  responses
    .filter((r) => r.policyVersion === version)
    .forEach((r) => {
      const row = ensure(r.employeeKey, r.employeeId, r.employeeName, false);
      // The name the employee typed is the freshest; the roster name is the fallback.
      if (r.employeeName) row.name = r.employeeName;
      if (r.response === "acknowledged") {
        row.status = "acknowledged";
        row.acknowledgedAt = Math.max(row.acknowledgedAt, toMillis(r.createdAt));
      } else if (r.response === "concern") {
        row.concerns += 1;
        if (r.postId) row.postIds.push(r.postId);
        if (row.status === "pending") row.status = "concern";
      }
    });

  const order = { pending: 0, concern: 1, acknowledged: 2 };
  const list = [...rows.values()].sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (a.status === "acknowledged" ? b.acknowledgedAt - a.acknowledgedAt : 0) ||
      a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true })
  );

  const summary = {
    rosterTotal: roster.length,
    acknowledged: list.filter((r) => r.status === "acknowledged").length,
    pending: list.filter((r) => r.status === "pending").length,
    concerns: list.reduce((sum, r) => sum + r.concerns, 0),
    offRoster: roster.length ? list.filter((r) => !r.onRoster).length : 0,
  };
  return { rows: list, summary };
};

/**
 * Bundle report: one row per employee across every policy in a bundle.
 *
 * Only responses to each policy's *current* version count. Row status: "acknowledged" when the
 * employee acknowledged every policy, "partial" when some, "concern" when none but they raised
 * one, otherwise "pending" (roster members only). `missing` lists the policy ids still open.
 *
 * @param {{roster: Array<object>, responses: Array<object>,
 *          policies: Array<{id: string, version: string}>}} input
 */
export const buildBundleReport = ({ roster = [], responses = [], policies = [] }) => {
  const currentVersion = new Map(policies.map((p) => [p.id, String(p.version)]));
  const rows = new Map();
  const ensure = (employeeKey, employeeId, name, onRoster) => {
    if (!rows.has(employeeKey)) {
      rows.set(employeeKey, {
        employeeKey,
        employeeId,
        name: name || "",
        onRoster,
        acknowledged: new Set(),
        status: "pending",
        acknowledgedAt: 0,
        concerns: 0,
        postIds: [],
        missing: [],
      });
    }
    return rows.get(employeeKey);
  };

  roster.forEach((e) => ensure(e.employeeKey, e.employeeId, e.name, true));

  responses
    .filter((r) => currentVersion.get(r.policyId) === r.policyVersion)
    .forEach((r) => {
      const row = ensure(r.employeeKey, r.employeeId, r.employeeName, false);
      if (r.employeeName) row.name = r.employeeName;
      if (r.response === "acknowledged") {
        row.acknowledged.add(r.policyId);
        row.acknowledgedAt = Math.max(row.acknowledgedAt, toMillis(r.createdAt));
      } else if (r.response === "concern") {
        row.concerns += 1;
        if (r.postId) row.postIds.push(r.postId);
      }
    });

  const total = policies.length;
  const perPolicy = new Map(policies.map((p) => [p.id, 0]));
  rows.forEach((row) => {
    row.acknowledged.forEach((id) => perPolicy.set(id, perPolicy.get(id) + 1));
    row.acknowledgedCount = row.acknowledged.size;
    row.total = total;
    row.missing = policies.filter((p) => !row.acknowledged.has(p.id)).map((p) => p.id);
    if (total > 0 && row.acknowledgedCount === total) row.status = "acknowledged";
    else if (row.acknowledgedCount > 0) row.status = "partial";
    else if (row.concerns > 0) row.status = "concern";
    delete row.acknowledged;
  });

  const order = { pending: 0, partial: 1, concern: 2, acknowledged: 3 };
  const list = [...rows.values()].sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (a.status === "acknowledged" ? b.acknowledgedAt - a.acknowledgedAt : 0) ||
      a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true })
  );

  const count = (status) => list.filter((r) => r.status === status).length;
  return {
    rows: list,
    perPolicy: policies.map((p) => ({ id: p.id, acknowledged: perPolicy.get(p.id) })),
    summary: {
      rosterTotal: roster.length,
      acknowledged: count("acknowledged"),
      partial: count("partial"),
      pending: count("pending"),
      concerns: list.reduce((sum, r) => sum + r.concerns, 0),
      offRoster: roster.length ? list.filter((r) => !r.onRoster).length : 0,
    },
  };
};
