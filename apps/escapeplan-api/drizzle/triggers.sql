-- =============================================================================
-- SECURITY TRIGGERS FOR USER_TYPE ENFORCEMENT
-- =============================================================================

-- Trigger 1: Prevent customers from having operator roles
DROP TRIGGER IF EXISTS prevent_customer_operator_role;
CREATE TRIGGER prevent_customer_operator_role
BEFORE INSERT ON user
WHEN NEW.user_type = 'customer'
  AND NEW.role_id IN (
    SELECT id FROM roles WHERE user_type_scope = 'operator'
  )
BEGIN
  SELECT RAISE(ABORT, 'Customers cannot have operator-only roles');
END;

-- Trigger 2: Prevent operators from having customer-only roles
DROP TRIGGER IF EXISTS prevent_operator_customer_role;
CREATE TRIGGER prevent_operator_customer_role
BEFORE INSERT ON user
WHEN NEW.user_type = 'operator'
  AND NEW.role_id IN (
    SELECT id FROM roles WHERE user_type_scope = 'customer' AND name = 'customer'
  )
BEGIN
  SELECT RAISE(ABORT, 'Operators cannot have customer-only roles');
END;

-- Trigger 3: Prevent user_type changes (immutable after creation)
DROP TRIGGER IF EXISTS prevent_user_type_change;
CREATE TRIGGER prevent_user_type_change
BEFORE UPDATE OF user_type ON user
WHEN OLD.user_type != NEW.user_type
BEGIN
  SELECT RAISE(ABORT, 'User type cannot be changed after creation');
END;

-- Trigger 4: Prevent role assignment outside user_type scope
DROP TRIGGER IF EXISTS enforce_role_user_type_scope;
CREATE TRIGGER enforce_role_user_type_scope
BEFORE INSERT ON user
WHEN NEW.role_id NOT IN (
  SELECT id FROM roles WHERE user_type_scope IN (NEW.user_type, 'both')
)
BEGIN
  SELECT RAISE(ABORT, 'Role not allowed for this user type');
END;

-- Trigger 5: Prevent role updates outside user_type scope
DROP TRIGGER IF EXISTS enforce_role_user_type_scope_update;
CREATE TRIGGER enforce_role_user_type_scope_update
BEFORE UPDATE OF role_id ON user
WHEN NEW.role_id NOT IN (
  SELECT id FROM roles WHERE user_type_scope IN (NEW.user_type, 'both')
)
BEGIN
  SELECT RAISE(ABORT, 'Role not allowed for this user type');
END;
