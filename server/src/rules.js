// Per-collection access rules — the MongoDB equivalent of the Supabase RLS
// policies. `readFilter` returns a Mongo filter merged (AND) into every read;
// `writeFilter` likewise for update/delete. `null` means unrestricted,
// `false` means denied.

const isPolice = (user) => user.role === 'police' || user.role === 'admin'

export const rules = {
  profiles: {
    // Names/avatars are needed across chat + police views: authed read is open.
    readFilter: () => null,
    writeFilter: (user) => (isPolice(user) ? null : { id: user.id }),
    insertCheck: (user, doc) => doc.id === user.id || isPolice(user),
  },
  devices: {
    readFilter: (user) =>
      isPolice(user)
        ? null
        : { $or: [{ owner_id: user.id }, { status: { $in: ['lost', 'stolen'] } }] },
    writeFilter: (user) => (isPolice(user) ? null : { owner_id: user.id }),
    insertCheck: (user, doc) => doc.owner_id === user.id || isPolice(user),
  },
  notifications: {
    readFilter: (user) => (isPolice(user) ? null : { user_id: user.id }),
    writeFilter: (user) => (isPolice(user) ? null : { user_id: user.id }),
    // The scanner/protection services create notifications for device owners.
    insertCheck: () => true,
  },
  beacon_logs: {
    // Finders (any signed-in scanner) report sightings of other people's
    // lost devices, and owners/police read them back.
    readFilter: () => null,
    writeFilter: (user) => (isPolice(user) ? null : false),
    insertCheck: () => true,
  },
  anti_theft_events: {
    readFilter: (user) => (isPolice(user) ? null : { owner_id: user.id }),
    writeFilter: (user) => (isPolice(user) ? null : { owner_id: user.id }),
    insertCheck: () => true,
  },
  protection_settings: {
    readFilter: (user) => (isPolice(user) ? null : { owner_id: user.id }),
    writeFilter: (user) => (isPolice(user) ? null : { owner_id: user.id }),
    insertCheck: (user, doc) => doc.owner_id === user.id || isPolice(user),
  },
  lost_reports: {
    readFilter: (user) => (isPolice(user) ? null : { owner_id: user.id }),
    writeFilter: (user) => (isPolice(user) ? null : { owner_id: user.id }),
    insertCheck: (user, doc) => doc.owner_id === user.id || isPolice(user),
  },
  chat_rooms: {
    readFilter: (user) => (isPolice(user) ? null : { owner_id: user.id }),
    writeFilter: (user) => (isPolice(user) ? null : { owner_id: user.id }),
    insertCheck: () => true,
  },
  chat_messages: {
    // Room membership is enforced coarsely: civilians only see messages in
    // rooms they own (resolved via room_ids the query engine passes through);
    // police see all. The engine restricts civilian reads to their rooms.
    readFilter: () => null, // refined in queryEngine via room ownership
    writeFilter: (user) => (isPolice(user) ? null : { sender_id: user.id }),
    insertCheck: () => true,
  },
}

export function getRule(table) {
  return rules[table] || null
}

export { isPolice }
