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
