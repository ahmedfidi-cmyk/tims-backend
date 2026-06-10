// In-memory RBAC adapters for unit tests and as the port reference impl.

import type { PrincipalType, UserStatus } from './rbac-policy.js';
import type {
  AccessAuditEntry,
  AccessAuditRepository,
  Person,
  PersonRepository,
  RoleGrant,
  RoleGrantRepository,
  User,
  UserRepository,
} from './rbac-types.js';

export class InMemoryPersonRepository implements PersonRepository {
  private readonly byId = new Map<string, Person>();
  async create(person: Person): Promise<Person> {
    this.byId.set(person.personId, { ...person });
    return { ...person };
  }
  async findById(personId: string): Promise<Person | null> {
    const p = this.byId.get(personId);
    return p ? { ...p } : null;
  }
  async findByPhone(primaryPhone: string): Promise<Person | null> {
    for (const p of this.byId.values()) if (p.primaryPhone === primaryPhone) return { ...p };
    return null;
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();
  async create(user: User): Promise<User> {
    this.byId.set(user.userId, { ...user });
    return { ...user };
  }
  async findById(userId: string): Promise<User | null> {
    const u = this.byId.get(userId);
    return u ? { ...u } : null;
  }
  async findByPersonAndType(personId: string, principalType: PrincipalType): Promise<User | null> {
    for (const u of this.byId.values()) {
      if (u.personId === personId && u.principalType === principalType) return { ...u };
    }
    return null;
  }
  async listByPerson(personId: string): Promise<User[]> {
    return [...this.byId.values()].filter((u) => u.personId === personId).map((u) => ({ ...u }));
  }
  async list(filter: { principalType?: PrincipalType; status?: UserStatus; limit?: number }): Promise<User[]> {
    let out = [...this.byId.values()]
      .filter((u) => (filter.principalType ? u.principalType === filter.principalType : true))
      .filter((u) => (filter.status ? u.status === filter.status : true))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((u) => ({ ...u }))
    if (filter.limit) out = out.slice(0, filter.limit)
    return out
  }
  async updateStatus(userId: string, status: UserStatus): Promise<void> {
    const u = this.byId.get(userId);
    if (u) u.status = status;
  }
}

export class InMemoryRoleGrantRepository implements RoleGrantRepository {
  private readonly grants: RoleGrant[] = [];
  async grant(grant: RoleGrant): Promise<void> {
    this.grants.push({ ...grant });
  }
  async revoke(userId: string, roleId: string): Promise<boolean> {
    const idx = this.grants.findIndex((g) => g.userId === userId && g.roleId === roleId);
    if (idx === -1) return false;
    this.grants.splice(idx, 1);
    return true;
  }
  async listForUser(userId: string): Promise<string[]> {
    return this.grants.filter((g) => g.userId === userId).map((g) => g.roleId);
  }
  async hasGrant(userId: string, roleId: string): Promise<boolean> {
    return this.grants.some((g) => g.userId === userId && g.roleId === roleId);
  }
}

export class InMemoryAccessAuditRepository implements AccessAuditRepository {
  readonly entries: AccessAuditEntry[] = [];
  async append(entry: AccessAuditEntry): Promise<void> {
    this.entries.push({ ...entry });
  }
  async list(filter: { actorUserId?: string; actedOnUserId?: string; limit?: number }): Promise<AccessAuditEntry[]> {
    let out = [...this.entries];
    if (filter.actorUserId) out = out.filter((e) => e.actorUserId === filter.actorUserId);
    if (filter.actedOnUserId) out = out.filter((e) => e.actedOnUserId === filter.actedOnUserId);
    out.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    return filter.limit ? out.slice(0, filter.limit) : out;
  }
}
