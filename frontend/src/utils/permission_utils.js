export function has_permission(user, required_permission) {
  if (!user) {
    return false;
  }

  if (
    !required_permission ||
    (Array.isArray(required_permission) && required_permission.length === 0)
  ) {
    return true;
  }

  const user_roles = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    user.role,
    user.role_name,
  ]
    .filter(Boolean)
    .map((role_item) => String(role_item).toLowerCase());

  if (user_roles.includes("super-admin")) {
    return true;
  }

  if (
    user.is_demo &&
    (user_roles.includes("admin") || user_roles.includes("administrator"))
  ) {
    return true;
  }

  const required_list = Array.isArray(required_permission)
    ? required_permission
    : [required_permission];

  if (Array.isArray(user.permissions)) {
    return required_list.some((req_perm) =>
      user.permissions.some((perm) => {
        const perm_name = typeof perm === "string" ? perm : perm?.name;
        return perm_name === req_perm;
      }),
    );
  }

  return false;
}
