import { p } from "./permissions";
import { ROLE_USER } from "./roles";

export type EscalationRiskSeverity = "critical" | "high" | "medium";

export type EscalationRisk = {
  severity: EscalationRiskSeverity;
  title: string;
  description: string;
  rule: string;
  toxicPermissions?: string[];
};

export type CheckEscalationInput = {
  roleName: string;
  currentPermissionKeys: string[];
  newPermissionKey: string;
};

/**
 * Administrative permissions that should NEVER be assigned to the default base role (`user`),
 * because every newly registered user receives this role automatically.
 */
const BASE_ROLE_FORBIDDEN_PERMISSIONS = new Set([
  p.permissions.create.key,
  p.permissions.update.key,
  p.permissions.delete.key,
  p.roles.create.key,
  p.roles.update.key,
  p.roles.delete.key,
  p.roles.view_as.key,
  p.users.create.key,
  p.users.update.key,
  p.users.delete.key,
  p.organizations.delete.key,
  p.dashboard.basic.key,
  p.roles.menu.key,
  p.permissions.menu.key,
  p.users.menu.key,
  p.organizations.menu.key,
]);

/**
 * Toxic combinations (Separation of Duties / SoD conflicts).
 * Having both permissions in the same role enables a direct path to privilege escalation.
 */
const TOXIC_COMBINATIONS: Array<{
  permA: string;
  permB: string;
  severity: EscalationRiskSeverity;
  title: string;
  description: string;
}> = [
  {
    permA: p.roles.update.key,
    permB: p.users.update.key,
    severity: "critical",
    title: "Combinación tóxica: Gestión de roles + Edición de usuarios",
    description:
      "Permite a un usuario modificar permisos de roles y a la vez asignar roles a usuarios, facilitando el escalamiento vertical a superadministrador.",
  },
  {
    permA: p.permissions.update.key,
    permB: p.roles.update.key,
    severity: "critical",
    title: "Combinación tóxica: Gestión de permisos + Gestión de roles",
    description:
      "Permite inyectar permisos en cualquier rol y editar su estructura, otorgando control irrestricto de la autorización del sistema.",
  },
  {
    permA: p.permissions.update.key,
    permB: p.users.update.key,
    severity: "critical",
    title: "Combinación tóxica: Edición de usuarios + Gestión de permisos",
    description:
      "Permite alterar perfiles de usuarios mientras se manipula la asignación de permisos globales.",
  },
  {
    permA: p.organizations.update.key,
    permB: p.organizationMembers.create.key,
    severity: "high",
    title:
      "Combinación de alto riesgo: Edición de organizaciones + Invitaciones",
    description:
      "Permite modificar la configuración de organizaciones y auto-invitar o promover miembros con rangos elevados.",
  },
];

/**
 * Detects if assigning a permission to a role introduces a privilege escalation vector
 * or a Separation of Duties (SoD) toxic combination.
 */
export function detectPermissionEscalationRisk({
  roleName,
  currentPermissionKeys,
  newPermissionKey,
}: CheckEscalationInput): EscalationRisk | null {
  // 1. Check base role contamination
  if (
    roleName === ROLE_USER &&
    BASE_ROLE_FORBIDDEN_PERMISSIONS.has(newPermissionKey)
  ) {
    return {
      severity: "critical",
      rule: "base_role_administrative_exposure",
      title: "Riesgo crítico: Privilegio administrativo en rol base",
      description: `El rol '${roleName}' se asigna por defecto a todos los usuarios que se registran. Otorgar '${newPermissionKey}' expone funciones administrativas a cuentas públicas no verificadas.`,
    };
  }

  // 2. Check toxic combinations with existing permissions (higher priority than single-permission grants)
  const combinedSet = new Set([...currentPermissionKeys, newPermissionKey]);

  for (const combo of TOXIC_COMBINATIONS) {
    if (combinedSet.has(combo.permA) && combinedSet.has(combo.permB)) {
      if (
        newPermissionKey === combo.permA ||
        newPermissionKey === combo.permB
      ) {
        return {
          severity: combo.severity,
          rule: "toxic_combination",
          title: combo.title,
          description: combo.description,
          toxicPermissions: [combo.permA, combo.permB],
        };
      }
    }
  }

  // 3. Check single meta-permissions
  if (
    newPermissionKey === p.permissions.update.key ||
    newPermissionKey === p.permissions.create.key
  ) {
    return {
      severity: "critical",
      rule: "meta_permission_grant",
      title: "Riesgo de escalamiento: Asignación de meta-permisos",
      description: `El permiso '${newPermissionKey}' permite modificar qué permisos tienen los roles, lo que permite a sus miembros auto-otorgarse cualquier privilegio del sistema.`,
    };
  }

  if (newPermissionKey === p.roles.update.key) {
    return {
      severity: "high",
      rule: "role_management_grant",
      title: "Riesgo de escalamiento: Asignación de gestión de roles",
      description:
        "El permiso 'roles:update' permite reconfigurar las funciones y accesos de los roles en la plataforma.",
    };
  }

  return null;
}
