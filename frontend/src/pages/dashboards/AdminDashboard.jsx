import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  activityLogsApi,
  adminBoardingHousesApi,
  adminDashboardApi,
  adminReportsApi,
  errorLogsApi,
  systemConfigsApi,
  usersApi,
} from '../../api/client.js';
import { useAuth } from '../../auth/useAuth.js';
import AccountSettingsCard from '../../components/AccountSettingsCard.jsx';
import AppShell from '../../components/AppShell.jsx';
import AsyncState from '../../components/AsyncState.jsx';
import ModuleCard from '../../components/ModuleCard.jsx';
import {
  AlertTriangle,
  Bug,
  Building2,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Lock,
  Save,
  Search,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  asArray,
  formatCurrency,
  formatDate,
  formatDateTime,
  statusClassName,
} from '../../utils/format.js';

const emptyListState = Object.freeze({
  loading: true,
  error: null,
  items: [],
  meta: null,
});

const emptyDataState = Object.freeze({
  loading: true,
  error: null,
  data: null,
});

const adminSections = {
  '/admin/dashboard': 'dashboard',
  '/admin/users': 'users',
  '/admin/boarding-houses': 'boarding-houses',
  '/admin/reports': 'reports',
  '/admin/activity-logs': 'activity-logs',
  '/admin/error-logs': 'error-logs',
  '/admin/config': 'config',
  '/admin/profile': 'profile',
};

function listPayloadItems(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return asArray(data?.items);
}

function stateFromPayload(payload) {
  return {
    loading: false,
    error: null,
    items: listPayloadItems(payload.data),
    meta: payload.data?.meta || null,
  };
}

function SeverityPill({ severity = 'info' }) {
  return (
    <span className={`severity-pill severity-${severity}`}>
      {severity}
    </span>
  );
}

function AdminStat({ label, value, icon: Icon, tone = 'neutral' }) {
  return (
    <div className={`admin-stat admin-stat-${tone}`}>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
      {Icon && <Icon size={22} aria-hidden="true" />}
    </div>
  );
}

function SimpleBarChart({ rows, valueKey, labelKey = 'month', tone = 'teal' }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);

  return (
    <div className="admin-bars">
      {rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        return (
          <div className="admin-bar-row" key={row[labelKey]}>
            <span>{row[labelKey]}</span>
            <div className="admin-bar-track">
              <div
                className={`admin-bar-fill admin-bar-${tone}`}
                style={{ width: `${Math.max((value / max) * 100, value > 0 ? 6 : 0)}%` }}
              />
            </div>
            <strong>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function AdminModal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" role="presentation">
      <section className="modal-content admin-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" />
        </div>
        {children}
      </section>
    </div>
  );
}

function FormMessage({ error, success }) {
  if (!error && !success) {
    return null;
  }

  return (
    <div className={`mini-feedback ${error ? 'mini-error' : 'mini-success'}`}>
      <p>{error || success}</p>
    </div>
  );
}

function AdminDashboard() {
  const { authState } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = adminSections[location.pathname] || 'dashboard';

  const [dashboardState, setDashboardState] = useState(emptyDataState);
  const [usersState, setUsersState] = useState(emptyListState);
  const [activityState, setActivityState] = useState(emptyListState);
  const [errorState, setErrorState] = useState(emptyListState);
  const [configsState, setConfigsState] = useState(emptyDataState);
  const [housesState, setHousesState] = useState(emptyListState);
  const [incomeState, setIncomeState] = useState(emptyDataState);
  const [growthState, setGrowthState] = useState(emptyDataState);
  const [occupancyState, setOccupancyState] = useState(emptyDataState);

  const [userFilters, setUserFilters] = useState({ search: '', role: '', status: '', page: 1 });
  const [activityFilters, setActivityFilters] = useState({
    search: '',
    module: '',
    severity: '',
    date_from: '',
    date_to: '',
    page: 1,
  });
  const [errorFilters, setErrorFilters] = useState({ search: '', resolved: '0', page: 1 });
  const [reportFilters, setReportFilters] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString().slice(0, 7),
    to: new Date().toISOString().slice(0, 7),
  });

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [selectedError, setSelectedError] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [actionForm, setActionForm] = useState({});
  const [formMessage, setFormMessage] = useState({ error: '', success: '' });
  const [selectedErrorIds, setSelectedErrorIds] = useState([]);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [activitySince] = useState(() => new Date().toISOString());

  const dashboard = dashboardState.data || {};
  const users = usersState.items;
  const activityLogs = activityState.items;
  const errorLogs = errorState.items;
  const houses = housesState.items;
  const configGroups = configsState.data?.groups || {};

  const unresolvedErrors = Number(dashboard.unresolved_errors_count || errorState.meta?.total || 0);
  const quickStats = [
    { label: 'Users', value: String(dashboard.users_count?.total || 0), tone: 'mint' },
    { label: 'Boarding Houses', value: String(dashboard.boarding_houses_count || 0), tone: 'sky' },
    { label: 'Unresolved Errors', value: String(unresolvedErrors), tone: unresolvedErrors > 0 ? 'amber' : 'mint' },
    { label: 'Income This Month', value: formatCurrency(dashboard.platform_income_this_month || 0), tone: 'neutral' },
  ];

  const roleBreakdown = dashboard.role_breakdown || {};
  const roleTotal = Object.values(roleBreakdown).reduce((sum, value) => sum + Number(value || 0), 0);

  async function loadDashboard() {
    setDashboardState((current) => ({ ...current, loading: true, error: null }));
    try {
      const payload = await adminDashboardApi.get();
      setDashboardState({ loading: false, error: null, data: payload.data });
    } catch (error) {
      setDashboardState({ loading: false, error, data: null });
    }
  }

  async function loadUsers(nextFilters = userFilters) {
    setUsersState((current) => ({ ...current, loading: true, error: null }));
    try {
      const payload = await usersApi.list({
        search: nextFilters.search,
        role: nextFilters.role,
        status: nextFilters.status,
        page: nextFilters.page,
        limit: 20,
      });
      setUsersState(stateFromPayload(payload));
    } catch (error) {
      setUsersState({ loading: false, error, items: [], meta: null });
    }
  }

  async function loadActivity(nextFilters = activityFilters) {
    setActivityState((current) => ({ ...current, loading: true, error: null }));
    try {
      const payload = await activityLogsApi.list({ ...nextFilters, limit: 25 });
      setActivityState(stateFromPayload(payload));
    } catch (error) {
      setActivityState({ loading: false, error, items: [], meta: null });
    }
  }

  async function loadErrors(nextFilters = errorFilters) {
    setErrorState((current) => ({ ...current, loading: true, error: null }));
    try {
      const payload = await errorLogsApi.list({ ...nextFilters, limit: 20 });
      setErrorState(stateFromPayload(payload));
      setSelectedErrorIds([]);
    } catch (error) {
      setErrorState({ loading: false, error, items: [], meta: null });
    }
  }

  async function loadConfigs() {
    setConfigsState((current) => ({ ...current, loading: true, error: null }));
    try {
      const payload = await systemConfigsApi.list();
      setConfigsState({ loading: false, error: null, data: payload.data });
    } catch (error) {
      setConfigsState({ loading: false, error, data: null });
    }
  }

  async function loadHouses() {
    setHousesState((current) => ({ ...current, loading: true, error: null }));
    try {
      const payload = await adminBoardingHousesApi.list();
      setHousesState(stateFromPayload(payload));
    } catch (error) {
      setHousesState({ loading: false, error, items: [], meta: null });
    }
  }

  async function loadReports(nextFilters = reportFilters) {
    setIncomeState((current) => ({ ...current, loading: true, error: null }));
    setGrowthState((current) => ({ ...current, loading: true, error: null }));
    setOccupancyState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [income, growth, occupancy] = await Promise.all([
        adminReportsApi.income(nextFilters),
        adminReportsApi.userGrowth(nextFilters),
        adminReportsApi.occupancy(nextFilters),
      ]);
      setIncomeState({ loading: false, error: null, data: income.data });
      setGrowthState({ loading: false, error: null, data: growth.data });
      setOccupancyState({ loading: false, error: null, data: occupancy.data });
    } catch (error) {
      setIncomeState({ loading: false, error, data: null });
      setGrowthState({ loading: false, error, data: null });
      setOccupancyState({ loading: false, error, data: null });
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadDashboard();
      loadErrors(errorFilters);
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (activeSection === 'users') loadUsers();
      if (activeSection === 'activity-logs') loadActivity();
      if (activeSection === 'error-logs') loadErrors();
      if (activeSection === 'config') loadConfigs();
      if (activeSection === 'boarding-houses') loadHouses();
      if (activeSection === 'reports') loadReports();
    });
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'activity-logs') {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      try {
        const payload = await activityLogsApi.list({
          ...activityFilters,
          since: activitySince,
          limit: 1,
        });
        setNewActivityCount(Number(payload.data?.meta?.total || 0));
      } catch {
        setNewActivityCount(0);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [activeSection, activityFilters, activitySince]);

  async function openUser(userId) {
    setFormMessage({ error: '', success: '' });
    try {
      const payload = await usersApi.get(userId);
      setSelectedUser(payload.data);
    } catch (error) {
      setFormMessage({ error: error?.errors?.[0] || error?.message || 'Unable to load user.', success: '' });
    }
  }

  async function openHouse(boardingHouseId) {
    try {
      const payload = await adminBoardingHousesApi.get(boardingHouseId);
      setSelectedHouse(payload.data);
    } catch (error) {
      setFormMessage({ error: error?.errors?.[0] || error?.message || 'Unable to load boarding house.', success: '' });
    }
  }

  async function openError(errorId) {
    try {
      const payload = await errorLogsApi.get(errorId);
      setSelectedError(payload.data);
    } catch (error) {
      setFormMessage({ error: error?.errors?.[0] || error?.message || 'Unable to load error log.', success: '' });
    }
  }

  function openAction(type, user = null, defaults = {}) {
    setFormMessage({ error: '', success: '' });
    setActionModal({ type, user });
    setActionForm(defaults);
  }

  async function submitUserAction(event) {
    event.preventDefault();
    if (!actionModal?.user) return;

    const user = actionModal.user;
    setFormMessage({ error: '', success: '' });
    try {
      if (actionModal.type === 'deactivate') {
        await usersApi.deactivateWithReason(user.user_id, actionForm.reason || '');
      }
      if (actionModal.type === 'reactivate') {
        await usersApi.reactivate(user.user_id, actionForm.note || '');
      }
      if (actionModal.type === 'role') {
        await usersApi.changeRole(user.user_id, actionForm.role || user.role, actionForm.confirmation_code || '');
      }
      if (actionModal.type === 'reset') {
        const payload = await usersApi.resetPassword(user.user_id);
        setActionForm({ temp_password: payload.data?.temp_password || '' });
        setFormMessage({ error: '', success: 'Temporary password generated.' });
        await loadUsers();
        return;
      }

      setActionModal(null);
      await loadUsers();
      await loadDashboard();
    } catch (error) {
      setFormMessage({ error: error?.errors?.[0] || error?.message || 'Action failed.', success: '' });
    }
  }

  async function saveConfig(configKey, value) {
    setFormMessage({ error: '', success: '' });
    try {
      await systemConfigsApi.update(configKey, value);
      await loadConfigs();
      await loadDashboard();
      setFormMessage({ error: '', success: 'Configuration saved.' });
    } catch (error) {
      setFormMessage({ error: error?.errors?.[0] || error?.message || 'Unable to save configuration.', success: '' });
    }
  }

  async function resolveError(errorId, notes) {
    try {
      await errorLogsApi.resolve(errorId, notes);
      setSelectedError(null);
      await loadErrors();
      await loadDashboard();
    } catch (error) {
      setFormMessage({ error: error?.errors?.[0] || error?.message || 'Unable to resolve error.', success: '' });
    }
  }

  async function bulkResolveErrors(event) {
    event.preventDefault();
    try {
      await errorLogsApi.bulkResolve(selectedErrorIds, actionForm.resolution_notes || '');
      setActionModal(null);
      setSelectedErrorIds([]);
      await loadErrors();
      await loadDashboard();
    } catch (error) {
      setFormMessage({ error: error?.errors?.[0] || error?.message || 'Unable to resolve selected errors.', success: '' });
    }
  }

  function toggleErrorSelection(errorId) {
    setSelectedErrorIds((current) =>
      current.includes(errorId)
        ? current.filter((id) => id !== errorId)
        : [...current, errorId],
    );
  }

  const title = useMemo(() => {
    const labels = {
      dashboard: 'Administrator Overview',
      users: 'User Management',
      'boarding-houses': 'Boarding House Oversight',
      reports: 'Platform Reports',
      'activity-logs': 'Activity Logs',
      'error-logs': 'Error Logs',
      config: 'System Configuration',
      profile: 'Administrator Profile',
    };
    return labels[activeSection] || 'Administrator Overview';
  }, [activeSection]);

  return (
    <AppShell
      title={title}
      subtitle="Platform oversight, audit trail, user governance, and configuration."
      quickStats={quickStats}
    >
      <FormMessage error={formMessage.error} success={formMessage.success} />

      {activeSection === 'dashboard' && (
        <DashboardHome
          state={dashboardState}
          dashboard={dashboard}
          roleBreakdown={roleBreakdown}
          roleTotal={roleTotal}
          onNavigate={navigate}
          onRefresh={loadDashboard}
        />
      )}

      {activeSection === 'users' && (
        <UsersSection
          state={usersState}
          users={users}
          filters={userFilters}
          setFilters={setUserFilters}
          onLoad={loadUsers}
          onView={openUser}
          onAction={openAction}
          currentUserId={authState.user?.user_id}
        />
      )}

      {activeSection === 'boarding-houses' && (
        <BoardingHousesSection
          state={housesState}
          houses={houses}
          onLoad={loadHouses}
          onOpen={openHouse}
        />
      )}

      {activeSection === 'reports' && (
        <ReportsSection
          filters={reportFilters}
          setFilters={setReportFilters}
          onLoad={loadReports}
          incomeState={incomeState}
          growthState={growthState}
          occupancyState={occupancyState}
          currentUser={authState.user}
        />
      )}

      {activeSection === 'activity-logs' && (
        <ActivityLogsSection
          state={activityState}
          logs={activityLogs}
          filters={activityFilters}
          setFilters={setActivityFilters}
          onLoad={loadActivity}
          newCount={newActivityCount}
        />
      )}

      {activeSection === 'error-logs' && (
        <ErrorLogsSection
          state={errorState}
          logs={errorLogs}
          filters={errorFilters}
          setFilters={setErrorFilters}
          onLoad={loadErrors}
          onOpen={openError}
          selectedIds={selectedErrorIds}
          onToggleSelected={toggleErrorSelection}
          onBulkResolve={() => openAction('bulkResolve')}
        />
      )}

      {activeSection === 'config' && (
        <SystemConfigSection
          state={configsState}
          groups={configGroups}
          onLoad={loadConfigs}
          onSave={saveConfig}
          onConfirmMaintenance={(key, value) => openAction('maintenance', null, { key, value })}
          lastChange={configsState.data?.last_change}
        />
      )}

      {activeSection === 'profile' && (
        <AdminProfileSection
          currentUser={authState.user}
          activityLogs={dashboard.recent_critical_logs || []}
        />
      )}

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          currentUserId={authState.user?.user_id}
          onClose={() => setSelectedUser(null)}
          onAction={openAction}
        />
      )}

      {selectedHouse && (
        <BoardingHouseDetailModal
          detail={selectedHouse}
          onClose={() => setSelectedHouse(null)}
        />
      )}

      {selectedError && (
        <ErrorDetailDrawer
          errorLog={selectedError}
          onClose={() => setSelectedError(null)}
          onResolve={resolveError}
        />
      )}

      {actionModal && (
        <ActionModal
          modal={actionModal}
          form={actionForm}
          setForm={setActionForm}
          message={formMessage}
          onClose={() => {
            setActionModal(null);
            setActionForm({});
            setFormMessage({ error: '', success: '' });
          }}
          onSubmit={actionModal.type === 'bulkResolve' ? bulkResolveErrors : submitUserAction}
          onSaveConfig={async () => {
            await saveConfig(actionForm.key, actionForm.value);
            setActionModal(null);
          }}
          selectedCount={selectedErrorIds.length}
        />
      )}
    </AppShell>
  );
}

function DashboardHome({ state, dashboard, roleBreakdown, roleTotal, onNavigate, onRefresh }) {
  const growthRows = asArray(dashboard.user_growth).slice(-14);
  const recentLogs = asArray(dashboard.recent_critical_logs);

  return (
    <AsyncState
      loading={state.loading}
      error={state.error}
      isEmpty={!dashboard.users_count}
      onRetry={onRefresh}
      loadingText="Loading administrator overview..."
    >
      <section className="admin-stat-grid">
        <AdminStat label="Total Users" value={dashboard.users_count?.total || 0} icon={Users} tone="teal" />
        <AdminStat label="Active Landlords" value={dashboard.active_landlords_count || 0} icon={Building2} tone="green" />
        <AdminStat label="Active Seekers" value={dashboard.active_seekers_count || 0} icon={UserCheck} tone="teal" />
        <AdminStat label="Boarding Houses" value={dashboard.boarding_houses_count || 0} icon={Building2} tone="neutral" />
        <AdminStat label="Unresolved Errors" value={dashboard.unresolved_errors_count || 0} icon={Bug} tone={Number(dashboard.unresolved_errors_count || 0) > 0 ? 'red' : 'green'} />
        <AdminStat label="Income This Month" value={formatCurrency(dashboard.platform_income_this_month || 0)} icon={FileText} tone="gold" />
      </section>

      <section className="admin-two-col">
        <ModuleCard id="user-growth" title="User Growth" description="Last 14 days">
          <SimpleBarChart rows={growthRows} valueKey="total" labelKey="date" />
        </ModuleCard>
        <ModuleCard id="role-breakdown" title="Role Breakdown" description={`${roleTotal} total users`}>
          <div className="role-breakdown">
            {Object.entries(roleBreakdown).map(([role, count]) => (
              <div key={role}>
                <span>{role}</span>
                <strong>{count}</strong>
                <div className="admin-bar-track">
                  <div
                    className="admin-bar-fill admin-bar-green"
                    style={{ width: `${roleTotal > 0 ? (Number(count) / roleTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ModuleCard>
      </section>

      <section className="admin-two-col admin-two-col-wide">
        <ModuleCard id="critical-activity" title="Recent Critical/Warning Activity" description="Latest non-info audit events">
          <div className="admin-feed">
            {recentLogs.length === 0 && <p>No warning or critical activity.</p>}
            {recentLogs.map((log) => (
              <div className="admin-feed-row" key={log.log_id}>
                <SeverityPill severity={log.severity} />
                <div>
                  <strong>{log.action_performed}</strong>
                  <span>{log.user_name || 'System'} - {formatDateTime(log.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </ModuleCard>
        <ModuleCard id="quick-actions" title="Quick Actions" description="Administrator shortcuts">
          <div className="admin-action-list">
            <button type="button" className="button-light danger" onClick={() => onNavigate('/admin/error-logs')}>
              <Bug size={16} /> View Unresolved Errors
            </button>
            <button type="button" className="button-light" onClick={() => onNavigate('/admin/activity-logs')}>
              <Download size={16} /> Export Activity Log
            </button>
            <button type="button" className="button-light" onClick={() => onNavigate('/admin/reports')}>
              <FileText size={16} /> View Platform Reports
            </button>
            <button type="button" className="button-light" onClick={() => onNavigate('/admin/config')}>
              <Shield size={16} /> System Config
            </button>
          </div>
        </ModuleCard>
      </section>
    </AsyncState>
  );
}

function UsersSection({ state, users, filters, setFilters, onLoad, onView, onAction, currentUserId }) {
  function apply(event) {
    event.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    onLoad(next);
  }

  return (
    <ModuleCard
      id="users"
      title="User Governance"
      description={`Showing ${users.length} of ${state.meta?.total || users.length} users`}
      actions={<button type="button" className="button-light" onClick={() => onLoad(filters)}>Refresh</button>}
    >
      <form className="admin-filter-row" onSubmit={apply}>
        <label className="admin-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search users"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
        </label>
        <select value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}>
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
          <option value="seeker">Seeker</option>
          <option value="parent">Parent</option>
        </select>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button type="submit" className="button-light">Apply</button>
      </form>

      <AsyncState loading={state.loading} error={state.error} isEmpty={users.length === 0} onRetry={() => onLoad(filters)}>
        <div className="table-wrap admin-users-table-wrap">
          <table className="data-table admin-fixed-table">
            <colgroup>
              <col className="admin-col-name" />
              <col className="admin-col-email" />
              <col className="admin-col-role" />
              <col className="admin-col-status" />
              <col className="admin-col-date" />
              <col className="admin-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Registered</th>
                <th className="action-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.user_id}>
                  <td data-label="Name">
                    <div className="admin-user-cell">
                      <span className={`admin-avatar avatar-${user.role}`}>{user.full_name?.charAt(0) || 'U'}</span>
                      <strong className="admin-text-clip" title={user.full_name}>{user.full_name}</strong>
                    </div>
                  </td>
                  <td data-label="Email">
                    <span className="admin-email-cell" title={user.email}>{user.email}</span>
                  </td>
                  <td data-label="Role"><span className={`role-pill role-${user.role}`}>{user.role}</span></td>
                  <td data-label="Status"><span className={`status-pill ${statusClassName(user.account_status)}`}>{user.account_status}</span></td>
                  <td data-label="Registered">{formatDate(user.created_at)}</td>
                  <td data-label="Actions" className="row-actions action-col">
                    <button type="button" className="button-light" onClick={() => onView(user.user_id)}>
                      <Eye size={14} /> View
                    </button>
                    {user.account_status === 'active' ? (
                      <button
                        type="button"
                        className="button-light danger"
                        disabled={user.user_id === currentUserId || user.role === 'admin'}
                        onClick={() => onAction('deactivate', user, { reason: '' })}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button type="button" className="button-light" onClick={() => onAction('reactivate', user, { note: '' })}>
                        Reactivate
                      </button>
                    )}
                    <button
                      type="button"
                      className="button-light"
                      disabled={user.user_id === currentUserId}
                      onClick={() => onAction('role', user, { role: user.role, confirmation_code: '' })}
                    >
                      Role
                    </button>
                    <button
                      type="button"
                      className="button-light"
                      disabled={user.user_id === currentUserId}
                      onClick={() => onAction('reset', user)}
                    >
                      Reset PW
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </ModuleCard>
  );
}

function BoardingHousesSection({ state, houses, onLoad, onOpen }) {
  return (
    <ModuleCard
      id="boarding-houses"
      title="Boarding House Oversight"
      description="Read-only operational overview across landlord properties."
      actions={<button type="button" className="button-light" onClick={onLoad}>Refresh</button>}
    >
      <AsyncState loading={state.loading} error={state.error} isEmpty={houses.length === 0} onRetry={onLoad}>
        <div className="admin-house-grid">
          {houses.map((house) => (
            <article className="admin-house-card" key={house.boarding_house_id}>
              <div className="admin-house-cover">
                {house.cover_photo_url ? <img src={house.cover_photo_url} alt="" /> : <Building2 size={34} />}
              </div>
              <div className="admin-house-body">
                <h3>{house.house_name}</h3>
                <p>{house.owner_name} - {house.owner_contact || house.owner_email}</p>
                <span>{house.address}</span>
                <div className="admin-pill-row">
                  <span>Rooms: {house.total_rooms}</span>
                  <span>Occupied: {house.occupied_rooms}</span>
                  <span>Available: {house.available_rooms}</span>
                </div>
                <div className="admin-progress">
                  <div style={{ width: `${Math.min(Number(house.collection_rate || 0), 100)}%` }} />
                </div>
                <button type="button" className="button-light" onClick={() => onOpen(house.boarding_house_id)}>
                  View Details
                </button>
              </div>
            </article>
          ))}
        </div>
      </AsyncState>
    </ModuleCard>
  );
}

function ReportsSection({ filters, setFilters, onLoad, incomeState, growthState, occupancyState, currentUser }) {
  const incomeRows = asArray(incomeState.data?.rows);
  const growthRows = asArray(growthState.data?.rows);
  const occupancyRows = asArray(occupancyState.data?.rows);
  const summary = incomeState.data?.summary || {};
  const occupancySummary = occupancyState.data?.summary || {};

  function apply(event) {
    event.preventDefault();
    onLoad(filters);
  }

  return (
    <>
      <ModuleCard id="reports" title="Platform Reports" description={`Generated for ${currentUser?.full_name || 'Administrator'}`}>
      <form className="admin-filter-row" onSubmit={apply}>
        <input type="month" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
        <input type="month" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
        <button type="submit" className="button-light">Load Report</button>
        <button type="button" className="button-light no-print" onClick={() => window.print()}>Print</button>
      </form>

      <div className="print-title">RentEase System Report - Platform Reports - Generated: {formatDateTime(new Date().toISOString())} by {currentUser?.full_name}</div>

      <section className="admin-stat-grid">
        <AdminStat label="Total Billed" value={formatCurrency(summary.total_billed || 0)} tone="neutral" />
        <AdminStat label="Collected" value={formatCurrency(summary.total_collected || 0)} tone="green" />
        <AdminStat label="Outstanding" value={formatCurrency(summary.total_outstanding || 0)} tone="red" />
        <AdminStat label="Average Rate" value={`${Number(summary.avg_rate || 0).toFixed(2)}%`} tone="teal" />
      </section>
      </ModuleCard>

      <section className="admin-two-col">
        <ModuleCard id="income-chart" title="Platform Income" description="Billed versus collected">
          <AsyncState loading={incomeState.loading} error={incomeState.error} isEmpty={incomeRows.length === 0}>
            <SimpleBarChart rows={incomeRows} valueKey="total_collected" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Month</th><th>Bills</th><th>Billed</th><th>Collected</th><th>Outstanding</th><th>Rate</th></tr>
                </thead>
                <tbody>
                  {incomeRows.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{row.bills}</td>
                      <td>{formatCurrency(row.total_billed)}</td>
                      <td>{formatCurrency(row.total_collected)}</td>
                      <td>{formatCurrency(row.outstanding)}</td>
                      <td>{Number(row.rate || 0).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncState>
        </ModuleCard>
        <ModuleCard id="growth-chart" title="User Growth" description="New users by month">
          <AsyncState loading={growthState.loading} error={growthState.error} isEmpty={growthRows.length === 0}>
            <SimpleBarChart rows={growthRows} valueKey="new_users" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Month</th><th>New Users</th><th>Owners</th><th>Seekers</th><th>Cumulative</th></tr>
                </thead>
                <tbody>
                  {growthRows.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{row.new_users}</td>
                      <td>{row.owner}</td>
                      <td>{row.seeker}</td>
                      <td>{row.cumulative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncState>
        </ModuleCard>
      </section>

      <ModuleCard id="occupancy-chart" title="Platform Occupancy" description="Current room availability">
        <AsyncState loading={occupancyState.loading} error={occupancyState.error} isEmpty={occupancyRows.length === 0}>
          <section className="admin-stat-grid compact">
            <AdminStat label="Total Rooms" value={occupancySummary.total_rooms || 0} />
            <AdminStat label="Occupied" value={occupancySummary.occupied_rooms || 0} tone="green" />
            <AdminStat label="Available" value={occupancySummary.available_rooms || 0} tone="teal" />
            <AdminStat label="Archived" value={occupancySummary.archived_rooms || 0} tone="neutral" />
            <AdminStat label="Rate" value={`${Number(occupancySummary.rate || 0).toFixed(2)}%`} tone="gold" />
          </section>
          <SimpleBarChart rows={occupancyRows} valueKey="occupied_rooms" />
        </AsyncState>
      </ModuleCard>
    </>
  );
}

function ActivityLogsSection({ state, logs, filters, setFilters, onLoad, newCount }) {
  function apply(event) {
    event.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    onLoad(next);
  }

  function clearFilters() {
    const next = { search: '', module: '', severity: '', date_from: '', date_to: '', page: 1 };
    setFilters(next);
    onLoad(next);
  }

  return (
    <ModuleCard
      id="activity-logs"
      title="Activity Logs"
      description={`${state.meta?.total || 0} matching entries`}
      actions={
        <button type="button" className="button-light" onClick={() => window.location.assign(activityLogsApi.exportUrl(filters))}>
          <Download size={16} /> Export CSV
        </button>
      }
    >
      <form className="admin-filter-row" onSubmit={apply}>
        <input type="datetime-local" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} />
        <input type="datetime-local" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} />
        <select value={filters.module} onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}>
          <option value="">All modules</option>
          <option value="auth">auth</option>
          <option value="users">users</option>
          <option value="rooms">rooms</option>
          <option value="reservations">reservations</option>
          <option value="billing">billing</option>
          <option value="guardian_links">guardian</option>
          <option value="boarding_house">boarding_house</option>
          <option value="system">system</option>
        </select>
        <select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}>
          <option value="">All severity</option>
          <option value="info">info</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
        <input type="search" placeholder="Search action" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
        <button type="submit" className="button-light">Apply</button>
        <button type="button" className="button-light" onClick={clearFilters}>Clear</button>
      </form>

      {newCount > 0 && <div className="admin-floating-badge">New entries since page load: {newCount}</div>}

      <AsyncState loading={state.loading} error={state.error} isEmpty={logs.length === 0} onRetry={() => onLoad(filters)}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Severity</th><th>IP Address</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.log_id} className={log.severity === 'critical' ? 'critical-row' : ''}>
                  <td>{formatDateTime(log.timestamp)}</td>
                  <td>{log.user_name || 'System'} {log.user_role && <span className={`role-pill role-${log.user_role}`}>{log.user_role}</span>}</td>
                  <td>{log.action_performed}</td>
                  <td>{log.affected_module}</td>
                  <td><SeverityPill severity={log.severity} /></td>
                  <td>{log.ip_address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </ModuleCard>
  );
}

function ErrorLogsSection({ state, logs, filters, setFilters, onLoad, onOpen, selectedIds, onToggleSelected, onBulkResolve }) {
  function switchTab(resolved) {
    const next = { ...filters, resolved, page: 1 };
    setFilters(next);
    onLoad(next);
  }

  function apply(event) {
    event.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    onLoad(next);
  }

  return (
    <ModuleCard id="error-logs" title="Error Logs" description={`${state.meta?.total || 0} matching errors`}>
      <div className="admin-tab-row">
        <button type="button" className={filters.resolved === '0' ? 'active' : ''} onClick={() => switchTab('0')}>Unresolved</button>
        <button type="button" className={filters.resolved === '1' ? 'active' : ''} onClick={() => switchTab('1')}>Resolved</button>
      </div>
      <form className="admin-filter-row" onSubmit={apply}>
        <input type="search" placeholder="Search errors" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
        <button type="submit" className="button-light">Apply</button>
      </form>

      {selectedIds.length > 0 && filters.resolved === '0' && (
        <div className="admin-sticky-action">
          <span>{selectedIds.length} selected</span>
          <button type="button" className="button-light" onClick={onBulkResolve}>Resolve Selected</button>
        </div>
      )}

      <AsyncState loading={state.loading} error={state.error} isEmpty={logs.length === 0} onRetry={() => onLoad(filters)}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {filters.resolved === '0' && <th className="action-col">Select</th>}
                <th>Timestamp</th><th>Error Code</th><th>Message</th><th>Affected User</th><th>Request</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.error_id}>
                  {filters.resolved === '0' && (
                    <td className="action-col">
                      <input type="checkbox" checked={selectedIds.includes(log.error_id)} onChange={() => onToggleSelected(log.error_id)} />
                    </td>
                  )}
                  <td>{formatDateTime(log.timestamp)}</td>
                  <td>{log.error_code}</td>
                  <td>{String(log.error_message || '').slice(0, 60)}</td>
                  <td>{log.user_name || 'System'}</td>
                  <td>{log.request_method || '-'} {log.request_url || ''}</td>
                  <td><button type="button" className="button-light" onClick={() => onOpen(log.error_id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </ModuleCard>
  );
}

function SystemConfigSection({ state, groups, onLoad, onSave, onConfirmMaintenance, lastChange }) {
  const maintenance = asArray(groups.general).find((item) => item.config_key === 'maintenance_mode');
  const maintenanceActive = maintenance?.config_value === 'true';

  return (
    <ModuleCard
      id="config"
      title="System Configuration"
      description="Changes take effect immediately."
      actions={<button type="button" className="button-light" onClick={onLoad}>Refresh</button>}
    >
      <div className="admin-warning-banner">
        <AlertTriangle size={18} /> Changes to system configuration take effect immediately. Proceed with caution.
      </div>
      {maintenanceActive && <div className="maintenance-mode-banner">MAINTENANCE MODE IS ACTIVE</div>}

      <AsyncState loading={state.loading} error={state.error} isEmpty={Object.keys(groups).length === 0} onRetry={onLoad}>
        {['general', 'limits', 'features', 'system'].map((groupName) => (
          <section className="admin-config-group" key={groupName}>
            <h3>{groupName}</h3>
            {asArray(groups[groupName]).map((config) => (
              <SystemConfigField
                key={`${config.config_key}-${config.config_value}`}
                config={config}
                onSave={onSave}
                onConfirmMaintenance={onConfirmMaintenance}
              />
            ))}
          </section>
        ))}
        <p className="admin-muted">
          Last config change: {lastChange?.updated_at ? formatDateTime(lastChange.updated_at) : 'N/A'} by {lastChange?.updated_by_name || 'N/A'}
        </p>
      </AsyncState>
    </ModuleCard>
  );
}

function SystemConfigField({ config, onSave, onConfirmMaintenance }) {
  const [value, setValue] = useState(config.config_value);
  const isToggle = config.config_key.includes('enabled') || config.config_key === 'maintenance_mode';
  const isNumber = ['max_guardian_links', 'max_room_photos', 'cancellation_window_hours'].includes(config.config_key);

  function save() {
    if (config.config_key === 'maintenance_mode' && value === 'true' && config.config_value !== 'true') {
      onConfirmMaintenance(config.config_key, value);
      return;
    }
    onSave(config.config_key, value);
  }

  return (
    <div className={`admin-config-field ${config.is_readonly ? 'readonly' : ''}`}>
      <div>
        <label>{config.label}</label>
        <span>{config.description}</span>
      </div>
      {isToggle ? (
        <button
          type="button"
          className={`admin-toggle ${value === 'true' ? 'on' : ''}`}
          disabled={config.is_readonly}
          onClick={() => {
            const next = value === 'true' ? 'false' : 'true';
            setValue(next);
            if (config.config_key === 'maintenance_mode' && next === 'false') {
              onSave(config.config_key, next);
            }
          }}
        >
          {value === 'true' ? 'ON' : 'OFF'}
        </button>
      ) : (
        <input
          type={isNumber ? 'number' : 'text'}
          value={value}
          readOnly={config.is_readonly}
          onChange={(event) => setValue(event.target.value)}
        />
      )}
      {config.is_readonly ? (
        <Lock size={18} />
      ) : (
        <button type="button" className="button-light" onClick={save}>
          <Save size={14} /> Save
        </button>
      )}
    </div>
  );
}

function AdminProfileSection({ currentUser, activityLogs }) {
  return (
    <>
      <AccountSettingsCard
        id="admin-profile"
        title="Profile"
        description="Administrator account details and password."
      />
      <ModuleCard id="admin-actions" title="My Administrative Actions" description="Recent warning and critical actions">
        <div className="admin-profile-badge">
          <Shield size={18} /> Role: Administrator
        </div>
        <p>Last login: {formatDateTime(currentUser?.last_login_at)}</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Timestamp</th><th>Action</th><th>Severity</th></tr>
            </thead>
            <tbody>
              {asArray(activityLogs).slice(0, 10).map((log) => (
                <tr key={log.log_id}>
                  <td>{formatDateTime(log.timestamp)}</td>
                  <td>{log.action_performed}</td>
                  <td><SeverityPill severity={log.severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ModuleCard>
    </>
  );
}

function UserDetailModal({ user, currentUserId, onClose, onAction }) {
  const isSelf = user.user_id === currentUserId;

  return (
    <AdminModal title="User Detail" onClose={onClose}>
      <div className="admin-user-detail-head">
        <span className={`admin-avatar large avatar-${user.role}`}>{user.full_name?.charAt(0) || 'U'}</span>
        <div>
          <h3>{user.full_name}</h3>
          <span className={`role-pill role-${user.role}`}>{user.role}</span>
          <span className={`status-pill ${statusClassName(user.account_status)}`}>{user.account_status}</span>
        </div>
      </div>
      <section className="admin-detail-grid">
        <p><strong>Email</strong>{user.email}</p>
        <p><strong>Contact</strong>{user.contact_number || 'N/A'}</p>
        <p><strong>School/Workplace</strong>{user.school_or_workplace || 'N/A'}</p>
        <p><strong>Last Login</strong>{formatDateTime(user.last_login_at)}</p>
        <p><strong>Registered</strong>{formatDateTime(user.created_at)}</p>
        <p><strong>Deactivated</strong>{formatDateTime(user.deactivated_at)}</p>
      </section>
      {user.deactivation_reason && <div className="admin-warning-banner">{user.deactivation_reason}</div>}
      {user.boarding_house && <p>Boarding house: {user.boarding_house.house_name}</p>}
      {user.active_reservation && <p>Active room: {user.active_reservation.house_name} - {user.active_reservation.room_number}</p>}

      <h3>Recent Activity</h3>
      <div className="admin-feed compact-feed">
        {asArray(user.activity_logs).map((log) => (
          <div className="admin-feed-row" key={log.log_id}>
            <SeverityPill severity={log.severity} />
            <div><strong>{log.action_performed}</strong><span>{formatDateTime(log.timestamp)}</span></div>
          </div>
        ))}
      </div>

      <div className="re-modal-actions">
        {user.account_status === 'active' ? (
          <button type="button" className="btn-danger" disabled={isSelf || user.role === 'admin'} onClick={() => onAction('deactivate', user, { reason: '' })}>Deactivate</button>
        ) : (
          <button type="button" className="btn-success" onClick={() => onAction('reactivate', user, { note: '' })}>Reactivate</button>
        )}
        <button type="button" className="btn-secondary" disabled={isSelf} onClick={() => onAction('role', user, { role: user.role, confirmation_code: '' })}>Change Role</button>
        <button type="button" className="btn-secondary" disabled={isSelf} onClick={() => onAction('reset', user)}>Reset Password</button>
      </div>
    </AdminModal>
  );
}

function BoardingHouseDetailModal({ detail, onClose }) {
  const house = detail.boarding_house || {};
  const rooms = asArray(detail.rooms);
  const tenants = asArray(detail.tenants);
  const financials = asArray(detail.financials);

  return (
    <AdminModal title={house.house_name || 'Boarding House'} onClose={onClose}>
      <p>{house.owner_name} - {house.address}</p>
      <section className="admin-three-col">
        <div>
          <h3>Rooms</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>No.</th><th>Type</th><th>Status</th><th>Tenant</th></tr></thead>
              <tbody>{rooms.map((room) => <tr key={room.room_id}><td>{room.room_number}</td><td>{room.room_type}</td><td>{room.availability_status}</td><td>{room.tenant_name || '-'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div>
          <h3>Tenants</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Room</th><th>Move-in</th><th>Rent</th></tr></thead>
              <tbody>{tenants.map((tenant) => <tr key={`${tenant.user_id}-${tenant.room_id}`}><td>{tenant.full_name}</td><td>{tenant.room_number}</td><td>{formatDate(tenant.move_in_date)}</td><td>{tenant.this_month_rent_status}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div>
          <h3>Financials</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Month</th><th>Billed</th><th>Collected</th><th>Rate</th></tr></thead>
              <tbody>{financials.map((row) => <tr key={row.month}><td>{row.month}</td><td>{formatCurrency(row.billed)}</td><td>{formatCurrency(row.collected)}</td><td>{Number(row.rate || 0).toFixed(2)}%</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminModal>
  );
}

function ErrorDetailDrawer({ errorLog, onClose, onResolve }) {
  const [notes, setNotes] = useState('');

  return (
    <div className="admin-drawer-backdrop">
      <aside className="admin-error-drawer">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close" />
        <h2>{errorLog.error_code}</h2>
        <p>{formatDateTime(errorLog.timestamp)}</p>
        <div className="admin-warning-banner">{errorLog.error_message}</div>
        <p><strong>Affected user:</strong> {errorLog.user_name || 'System'}</p>
        <p><strong>Request:</strong> {errorLog.request_method || '-'} {errorLog.request_url || ''}</p>
        <pre className="admin-stack-trace">{errorLog.stack_trace || 'No stack trace captured.'}</pre>
        {Number(errorLog.is_resolved) === 1 ? (
          <div className="admin-resolved-box">
            <CheckCircle2 size={18} /> Resolved by {errorLog.resolver_name || 'Administrator'} on {formatDateTime(errorLog.resolved_at)}
            <p>{errorLog.resolution_notes}</p>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); onResolve(errorLog.error_id, notes); }}>
            <textarea value={notes} minLength={20} maxLength={1000} onChange={(event) => setNotes(event.target.value)} placeholder="Resolution notes" required />
            <p>{notes.length}/1000</p>
            <button type="submit" className="btn-success">Mark as Resolved</button>
          </form>
        )}
      </aside>
    </div>
  );
}

function ActionModal({ modal, form, setForm, message, onClose, onSubmit, onSaveConfig, selectedCount }) {
  if (modal.type === 'maintenance') {
    return (
      <AdminModal title="Enable Maintenance Mode" onClose={onClose}>
        <div className="admin-danger-panel">Enabling maintenance mode will lock out all non-admin users immediately.</div>
        <div className="re-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-danger" onClick={onSaveConfig}>Enable Maintenance Mode</button>
        </div>
      </AdminModal>
    );
  }

  if (modal.type === 'bulkResolve') {
    return (
      <AdminModal title={`Resolving ${selectedCount} error logs`} onClose={onClose}>
        <form onSubmit={onSubmit}>
          <textarea value={form.resolution_notes || ''} minLength={20} maxLength={1000} onChange={(event) => setForm((current) => ({ ...current, resolution_notes: event.target.value }))} required />
          <FormMessage error={message.error} success={message.success} />
          <div className="re-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-success">Confirm and Resolve All</button>
          </div>
        </form>
      </AdminModal>
    );
  }

  const user = modal.user || {};
  const isResetDone = modal.type === 'reset' && form.temp_password;

  return (
    <AdminModal title={`${modal.type} ${user.full_name || ''}`} onClose={onClose}>
      <form onSubmit={onSubmit}>
        {modal.type === 'deactivate' && (
          <>
            <div className="admin-danger-panel">This will prevent the user from logging in.</div>
            <textarea value={form.reason || ''} minLength={10} maxLength={500} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
            <p>{(form.reason || '').length}/500</p>
          </>
        )}
        {modal.type === 'reactivate' && (
          <textarea value={form.note || ''} maxLength={300} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
        )}
        {modal.type === 'role' && (
          <>
            <select value={form.role || user.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="seeker">seeker</option>
              <option value="parent">parent</option>
              <option value="owner">owner</option>
              <option value="admin">admin</option>
            </select>
            {(form.role || user.role) === 'admin' && (
              <div className="admin-danger-panel">
                <p>You are granting full system administrator access.</p>
                <input value={form.confirmation_code || ''} onChange={(event) => setForm((current) => ({ ...current, confirmation_code: event.target.value }))} placeholder="CONFIRM" />
              </div>
            )}
          </>
        )}
        {modal.type === 'reset' && !isResetDone && (
          <div className="admin-warning-banner">A temporary password will be generated and shown once.</div>
        )}
        {isResetDone && (
          <div className="admin-temp-password">
            <code>{form.temp_password}</code>
            <button type="button" className="button-light" onClick={() => navigator.clipboard?.writeText(form.temp_password)}>Copy</button>
          </div>
        )}
        <FormMessage error={message.error} success={message.success} />
        <div className="re-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>{isResetDone ? 'Close' : 'Cancel'}</button>
          {!isResetDone && (
            <button
              type="submit"
              className={modal.type === 'deactivate' || modal.type === 'reset' ? 'btn-danger' : 'btn-success'}
              disabled={modal.type === 'role' && (form.role || user.role) === 'admin' && form.confirmation_code !== 'CONFIRM'}
            >
              {modal.type === 'reset' ? 'Generate Password' : 'Submit'}
            </button>
          )}
        </div>
      </form>
    </AdminModal>
  );
}

export default AdminDashboard;
