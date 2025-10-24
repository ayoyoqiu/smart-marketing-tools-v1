-- ==========================================
-- 游客用户功能数据库迁移脚本
-- 版本: v1.0.2-guest-user
-- 日期: 2025-10-24
-- 作用: 添加guest角色，修改默认注册角色
-- ==========================================

-- ==========================================
-- 第一步：修改users表的role字段
-- ==========================================

-- 1. 查看当前role字段的约束
DO $$ 
BEGIN
  RAISE NOTICE '📋 开始游客用户角色迁移...';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- 2. 删除旧的角色约束（如果存在）
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;
DO $$ 
BEGIN
  RAISE NOTICE '✅ 已删除旧的角色约束';
END $$;

-- 3. 添加新的角色约束（包含guest）
ALTER TABLE users ADD CONSTRAINT check_user_role 
CHECK (role IN ('guest', 'user', 'admin', 'super_admin'));
DO $$ 
BEGIN
  RAISE NOTICE '✅ 已添加新的角色约束（包含guest）';
  RAISE NOTICE '   允许的角色: guest, user, admin, super_admin';
END $$;

-- 4. 修改role字段的默认值为'guest'
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'guest';
DO $$ 
BEGIN
  RAISE NOTICE '✅ 已修改默认角色: user → guest';
  RAISE NOTICE '   新注册用户将自动获得guest角色';
END $$;

-- ==========================================
-- 第二步：创建用户角色升级记录表
-- ==========================================

-- 创建升级记录表
CREATE TABLE IF NOT EXISTS user_role_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_role VARCHAR(20) NOT NULL,
  to_role VARCHAR(20) NOT NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  request_reason TEXT,
  status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 添加注释
COMMENT ON TABLE user_role_upgrades IS '用户角色升级记录表';
COMMENT ON COLUMN user_role_upgrades.user_id IS '被升级的用户ID';
COMMENT ON COLUMN user_role_upgrades.from_role IS '原角色';
COMMENT ON COLUMN user_role_upgrades.to_role IS '目标角色';
COMMENT ON COLUMN user_role_upgrades.approved_by IS '审核人ID（管理员）';
COMMENT ON COLUMN user_role_upgrades.approved_at IS '审核时间';
COMMENT ON COLUMN user_role_upgrades.reason IS '审核说明（管理员填写）';
COMMENT ON COLUMN user_role_upgrades.request_reason IS '申请理由（用户填写）';
COMMENT ON COLUMN user_role_upgrades.status IS '申请状态：pending-待审核, approved-已批准, rejected-已拒绝';

DO $$ 
BEGIN
  RAISE NOTICE '✅ 已创建用户角色升级记录表: user_role_upgrades';
END $$;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_role_upgrades_user ON user_role_upgrades(user_id);
CREATE INDEX IF NOT EXISTS idx_role_upgrades_approved_by ON user_role_upgrades(approved_by);
CREATE INDEX IF NOT EXISTS idx_role_upgrades_status ON user_role_upgrades(status);
CREATE INDEX IF NOT EXISTS idx_role_upgrades_created_at ON user_role_upgrades(created_at DESC);

DO $$ 
BEGIN
  RAISE NOTICE '✅ 已创建索引：';
  RAISE NOTICE '   • idx_role_upgrades_user';
  RAISE NOTICE '   • idx_role_upgrades_approved_by';
  RAISE NOTICE '   • idx_role_upgrades_status';
  RAISE NOTICE '   • idx_role_upgrades_created_at';
END $$;

-- ==========================================
-- 第三步：创建用户升级申请表（可选）
-- ==========================================

-- 用于存储待审核的升级申请
CREATE TABLE IF NOT EXISTS user_upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_role VARCHAR(20) NOT NULL,
  to_role VARCHAR(20) NOT NULL,
  request_reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, status) -- 每个用户同时只能有一个待审核的申请
);

-- 添加注释
COMMENT ON TABLE user_upgrade_requests IS '用户升级申请表（待审核）';
COMMENT ON COLUMN user_upgrade_requests.user_id IS '申请用户ID';
COMMENT ON COLUMN user_upgrade_requests.from_role IS '当前角色';
COMMENT ON COLUMN user_upgrade_requests.to_role IS '期望角色';
COMMENT ON COLUMN user_upgrade_requests.request_reason IS '申请理由';
COMMENT ON COLUMN user_upgrade_requests.status IS 'pending-待审核, approved-已批准, rejected-已拒绝';
COMMENT ON COLUMN user_upgrade_requests.approved_by IS '审核人ID';
COMMENT ON COLUMN user_upgrade_requests.rejection_reason IS '拒绝原因';

DO $$ 
BEGIN
  RAISE NOTICE '✅ 已创建用户升级申请表: user_upgrade_requests';
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_user ON user_upgrade_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON user_upgrade_requests(status);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_created_at ON user_upgrade_requests(created_at DESC);

DO $$ 
BEGIN
  RAISE NOTICE '✅ 已创建升级申请表索引';
END $$;

-- ==========================================
-- 第四步：创建触发器自动更新updated_at
-- ==========================================

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为user_role_upgrades表创建触发器
DROP TRIGGER IF EXISTS trigger_update_role_upgrades_updated_at ON user_role_upgrades;
CREATE TRIGGER trigger_update_role_upgrades_updated_at
BEFORE UPDATE ON user_role_upgrades
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 为user_upgrade_requests表创建触发器
DROP TRIGGER IF EXISTS trigger_update_upgrade_requests_updated_at ON user_upgrade_requests;
CREATE TRIGGER trigger_update_upgrade_requests_updated_at
BEFORE UPDATE ON user_upgrade_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DO $$ 
BEGIN
  RAISE NOTICE '✅ 已创建updated_at自动更新触发器';
END $$;

-- ==========================================
-- 第五步：数据验证和检查
-- ==========================================

-- 验证角色约束
DO $$ 
DECLARE
  v_constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.check_constraints 
    WHERE constraint_name = 'check_user_role'
  ) INTO v_constraint_exists;
  
  IF v_constraint_exists THEN
    RAISE NOTICE '✅ 角色约束验证通过';
  ELSE
    RAISE WARNING '⚠️ 角色约束未找到';
  END IF;
END $$;

-- 验证默认值
DO $$ 
DECLARE
  v_default_role TEXT;
BEGIN
  SELECT column_default 
  FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'role'
  INTO v_default_role;
  
  IF v_default_role LIKE '%guest%' THEN
    RAISE NOTICE '✅ 默认角色验证通过: %', v_default_role;
  ELSE
    RAISE WARNING '⚠️ 默认角色可能未正确设置: %', v_default_role;
  END IF;
END $$;

-- 验证新表
DO $$ 
DECLARE
  v_upgrades_exists BOOLEAN;
  v_requests_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_role_upgrades') INTO v_upgrades_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_upgrade_requests') INTO v_requests_exists;
  
  IF v_upgrades_exists AND v_requests_exists THEN
    RAISE NOTICE '✅ 所有新表创建成功';
  ELSE
    RAISE WARNING '⚠️ 部分表未创建成功';
  END IF;
END $$;

-- ==========================================
-- 第六步：RLS（行级安全策略）设置
-- ==========================================

-- 为user_role_upgrades表启用RLS
ALTER TABLE user_role_upgrades ENABLE ROW LEVEL SECURITY;

-- 策略1：所有用户可以查看自己的升级记录
CREATE POLICY "Users can view their own upgrade history"
ON user_role_upgrades FOR SELECT
USING (auth.uid() = user_id OR 
       EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 策略2：管理员可以查看所有升级记录
CREATE POLICY "Admins can view all upgrade history"
ON user_role_upgrades FOR SELECT
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 策略3：只有管理员可以创建升级记录
CREATE POLICY "Only admins can create upgrade records"
ON user_role_upgrades FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

DO $$ 
BEGIN
  RAISE NOTICE '✅ user_role_upgrades表RLS策略已设置';
END $$;

-- 为user_upgrade_requests表启用RLS
ALTER TABLE user_upgrade_requests ENABLE ROW LEVEL SECURITY;

-- 策略1：用户可以创建自己的升级申请
CREATE POLICY "Users can create their own upgrade requests"
ON user_upgrade_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 策略2：用户可以查看自己的申请
CREATE POLICY "Users can view their own requests"
ON user_upgrade_requests FOR SELECT
USING (auth.uid() = user_id OR 
       EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 策略3：管理员可以查看所有申请
CREATE POLICY "Admins can view all requests"
ON user_upgrade_requests FOR SELECT
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 策略4：只有管理员可以更新申请状态
CREATE POLICY "Only admins can update requests"
ON user_upgrade_requests FOR UPDATE
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

DO $$ 
BEGIN
  RAISE NOTICE '✅ user_upgrade_requests表RLS策略已设置';
END $$;

-- ==========================================
-- 完成通知
-- ==========================================

DO $$ 
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ 游客用户角色迁移完成！';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📋 已完成的操作：';
  RAISE NOTICE '   1. ✅ 修改users.role默认值为guest';
  RAISE NOTICE '   2. ✅ 更新角色约束包含guest';
  RAISE NOTICE '   3. ✅ 创建user_role_upgrades表';
  RAISE NOTICE '   4. ✅ 创建user_upgrade_requests表';
  RAISE NOTICE '   5. ✅ 创建索引优化查询';
  RAISE NOTICE '   6. ✅ 创建自动更新触发器';
  RAISE NOTICE '   7. ✅ 设置RLS安全策略';
  RAISE NOTICE '';
  RAISE NOTICE '📊 影响范围：';
  RAISE NOTICE '   • 新注册用户将自动获得guest角色';
  RAISE NOTICE '   • 现有用户不受影响';
  RAISE NOTICE '   • guest用户可配置但不能发送';
  RAISE NOTICE '   • 需要管理员审核升级为user';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 验证查询：';
  RAISE NOTICE '   SELECT column_default FROM information_schema.columns';
  RAISE NOTICE '   WHERE table_name = ''users'' AND column_name = ''role'';';
  RAISE NOTICE '';
  RAISE NOTICE '📖 下一步：';
  RAISE NOTICE '   • 更新前端代码添加isGuest()判断';
  RAISE NOTICE '   • 更新后端代码添加角色检查';
  RAISE NOTICE '   • 创建管理员升级审核界面';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- 查询当前配置
SELECT 
  '验证结果' as title,
  column_default as "默认角色",
  data_type as "数据类型"
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'role';

