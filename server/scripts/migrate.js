import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { MongoClient } from 'mongodb'

// One-shot Supabase (Postgres) -> MongoDB Atlas data migration.
// Idempotent: re-running upserts by id, so it can be used to re-sync.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MONGO_URI (+ MONGO_DB)

const TABLES = [
  'profiles',
  'devices',
  'lost_reports',
  'notifications',
  'beacon_logs',
  'anti_theft_events',
  'protection_settings',
  'chat_rooms',
  'chat_messages',
]

const PAGE_SIZE = 1000

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MONGO_URI } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MONGO_URI) {
    console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and MONGO_URI in server/.env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const mongo = new MongoClient(MONGO_URI)
  await mongo.connect()
  const db = mongo.db(process.env.MONGO_DB || 'loqit')
  console.log(`Migrating into Mongo database "${db.databaseName}"\n`)

  let grandTotal = 0
  for (const table of TABLES) {
    let from = 0
    let total = 0
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(from, from + PAGE_SIZE - 1)
      if (error) {
        console.error(`  ${table}: FAILED — ${error.message}`)
        break
      }
      if (!data || data.length === 0) break

      const ops = data.map((row) => {
        const id = row.id ?? `${table}-${from + total}`
        return {
          replaceOne: {
            filter: { id },
            replacement: { _id: id, ...row },
            upsert: true,
          },
        }
      })
      await db.collection(table).bulkWrite(ops, { ordered: false })
      total += data.length
      from += PAGE_SIZE
      if (data.length < PAGE_SIZE) break
    }
    grandTotal += total
    console.log(`  ${table}: ${total} rows migrated`)
  }

  console.log(`\nDone. ${grandTotal} rows total.`)
  await mongo.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
