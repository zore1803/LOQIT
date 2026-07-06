import { MongoClient } from 'mongodb'

let client
let db

export async function connectMongo() {
  if (db) return db
  const uri = process.env.MONGO_URI
  if (!uri) throw new Error('MONGO_URI is not set')
  client = new MongoClient(uri)
  await client.connect()
  db = client.db(process.env.MONGO_DB || 'loqit')
  await ensureIndexes(db)
  console.log(`[mongo] connected to database "${db.databaseName}"`)
  return db
}

export function getDb() {
  if (!db) throw new Error('Mongo not connected yet')
  return db
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection('devices').createIndex({ owner_id: 1 }),
    db.collection('devices').createIndex({ serial_number: 1 }),
    db.collection('devices').createIndex({ status: 1 }),
    db.collection('notifications').createIndex({ user_id: 1, created_at: -1 }),
    db.collection('beacon_logs').createIndex({ device_id: 1, reported_at: -1 }),
    db.collection('chat_messages').createIndex({ room_id: 1, created_at: 1 }),
    db.collection('chat_rooms').createIndex({ owner_id: 1 }),
    db.collection('lost_reports').createIndex({ owner_id: 1 }),
    db.collection('anti_theft_events').createIndex({ device_id: 1, created_at: -1 }),
    db.collection('protection_settings').createIndex({ device_id: 1 }),
  ]).catch((err) => console.warn('[mongo] index creation warning:', err.message))
}
