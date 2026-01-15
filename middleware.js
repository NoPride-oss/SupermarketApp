function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/users/login');
}
function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(403).send('Forbidden: Admins only');
}
module.exports = { isAuthenticated, isAdmin };
