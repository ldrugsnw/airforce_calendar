import { isAppSnapshot, type AppSnapshot } from './appSnapshot'

const CACHE_PREFIX = 'airforce-calendar:server-cache:'
const MIGRATION_BACKUP_PREFIX = 'airforce-calendar:migration-backup:'
const MIGRATION_BACKUP_DAYS = 7

export function loadServerCache(userId: string): AppSnapshot | null {
  try {
    const value = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${userId}`) ?? 'null')
    return isAppSnapshot(value) ? value : null
  } catch {
    return null
  }
}

export function saveServerCache(snapshot: AppSnapshot) {
  localStorage.setItem(
    `${CACHE_PREFIX}${snapshot.account.userId}`,
    JSON.stringify(snapshot),
  )
}

export function clearServerCache(userId: string) {
  localStorage.removeItem(`${CACHE_PREFIX}${userId}`)
}

export function saveMigrationBackup(userId: string, data: unknown) {
  const expiresAt = new Date(
    Date.now() + MIGRATION_BACKUP_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
  localStorage.setItem(
    `${MIGRATION_BACKUP_PREFIX}${userId}`,
    JSON.stringify({ data, expiresAt }),
  )
}

export function removeExpiredMigrationBackups() {
  const now = new Date().toISOString()
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (!key?.startsWith(MIGRATION_BACKUP_PREFIX)) continue
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '{}') as {
        expiresAt?: unknown
      }
      if (typeof value.expiresAt !== 'string' || value.expiresAt <= now) {
        localStorage.removeItem(key)
      }
    } catch {
      localStorage.removeItem(key)
    }
  }
}
