/**
 * admin.js
 * Short: Role/permission gates for routes.
 
 */

 /**
  * Require admin role to proceed.
  * @param {*} req
  * @param {*} res
  * @param {*} next
  */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}
