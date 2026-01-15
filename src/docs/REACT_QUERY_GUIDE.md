# React Query Quick Reference Guide

## 🚀 How to Convert Existing Components to React Query

### Pattern 1: Simple Data Fetching

**BEFORE (useState + useEffect):**
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await api.getData();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);
```

**AFTER (React Query v5):**
```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['dataKey'],  // Unique cache key
  queryFn: () => api.getData()  // Fetch function
});
```

**Benefits:**
- ✅ Automatic caching
- ✅ Automatic refetching
- ✅ Loading/error states built-in
- ✅ No more useEffect!

---

### Pattern 2: Data with Dependencies

**BEFORE:**
```typescript
useEffect(() => {
  if (companyId) {
    fetchCompanyData(companyId);
  }
}, [companyId]);
```

**AFTER:**
```typescript
const { data } = useQuery({
  queryKey: ['company', companyId],  // Key includes dependency
  queryFn: () => api.getCompany(companyId),
  enabled: !!companyId  // Only run if companyId exists
});
```

---

### Pattern 3: Mutations (Create/Update/Delete)

**BEFORE:**
```typescript
const handleCreate = async (newItem) => {
  setLoading(true);
  try {
    await api.create(newItem);
    // Manually refetch data
    fetchData();
  } catch (err) {
    setError(err);
  } finally {
    setLoading(false);
  }
};
```

**AFTER:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const createMutation = useMutation({
  mutationFn: (newItem) => api.create(newItem),
  onSuccess: () => {
    // Automatically refetch queries
    queryClient.invalidateQueries({ queryKey: ['items'] });
  }
});

const handleCreate = (newItem) => {
  createMutation.mutate(newItem);
};
```

---

### Pattern 4: Parallel Queries

**BEFORE:**
```typescript
useEffect(() => {
  Promise.all([
    fetchUsers(),
    fetchCompanies(),
    fetchSettings()
  ]);
}, []);
```

**AFTER:**
```typescript
const users = useQuery({ queryKey: ['users'], queryFn: api.getUsers });
const companies = useQuery({ queryKey: ['companies'], queryFn: api.getCompanies });
const settings = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });

// All run in parallel automatically!
```

---

### Pattern 5: Optimistic Updates

```typescript
const updateMutation = useMutation({
  mutationFn: (updatedItem) => api.update(updatedItem),
  // Update UI immediately (before API responds)
  onMutate: async (newItem) => {
    await queryClient.cancelQueries({ queryKey: ['items'] });
    
    const previousItems = queryClient.getQueryData(['items']);
    
    queryClient.setQueryData(['items'], (old) =>
      old.map(item => item.id === newItem.id ? newItem : item)
    );
    
    return { previousItems };
  },
  // Rollback on error
  onError: (err, newItem, context) => {
    queryClient.setQueryData(['items'], context.previousItems);
  }
});
```

---

## 🎯 Common Patterns for Novalare

### 1. Loading Companies List

```typescript
// In any component
const { data: companies, isLoading } = useQuery({
  queryKey: ['companies'],
  queryFn: () => companiesApi.getAll()
});
```

### 2. Loading Company Details

```typescript
const { data: company } = useQuery({
  queryKey: ['company', companyId],
  queryFn: () => companiesApi.getById(companyId),
  enabled: !!companyId
});
```

### 3. Loading Chart of Accounts

```typescript
const { data: coa } = useQuery({
  queryKey: ['coa', companyId],
  queryFn: async () => {
    const response = await fetch(
      `${apiUrl}/companies/${companyId}/coa`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  },
  enabled: !!companyId,
  staleTime: 10 * 60 * 1000  // 10 minutes
});
```

### 4. Loading Journal Entries

```typescript
const { data: entries } = useQuery({
  queryKey: ['journal-entries', companyId, period],
  queryFn: () => fetchJournalEntries(companyId, period),
  enabled: !!companyId && !!period
});
```

### 5. Creating a New Company

```typescript
const createCompany = useMutation({
  mutationFn: (newCompany) => companiesApi.create(newCompany),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    toast.success('Company created!');
  }
});

// Usage
<button onClick={() => createCompany.mutate(formData)}>
  {createCompany.isLoading ? 'Creating...' : 'Create'}
</button>
```

---

## 🔑 Cache Key Strategy

Use descriptive, hierarchical keys:

```typescript
// Bad
['data']

// Good
['companies']
['company', companyId]
['company', companyId, 'transactions']
['journal-entries', companyId, period]
['bank-rec', companyId, accountId, period]
```

---

## ⚙️ Configuration Options

```typescript
useQuery(
  ['key'],
  fetchFn,
  {
    // How long data stays fresh (no refetch)
    staleTime: 5 * 60 * 1000,  // 5 minutes
    
    // How long unused data stays in cache
    gcTime: 10 * 60 * 1000,  // 10 minutes
    
    // Refetch on window focus?
    refetchOnWindowFocus: false,
    
    // Refetch on internet reconnect?
    refetchOnReconnect: true,
    
    // How many times to retry failed requests
    retry: 1,
    
    // Only run query if condition met
    enabled: !!someValue,
    
    // Success callback
    onSuccess: (data) => console.log(data),
    
    // Error callback
    onError: (err) => console.error(err)
  }
);
```

---

## 🎨 UI Patterns

### Loading State
```typescript
if (isLoading) return <Skeleton />;
```

### Error State
```typescript
if (error) return <ErrorMessage error={error} />;
```

### Empty State
```typescript
if (data?.length === 0) return <EmptyState />;
```

### Combined
```typescript
const { data, isLoading, error } = useQuery(['items'], fetchItems);

if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage />;
if (!data?.length) return <EmptyState />;

return <ItemsList items={data} />;
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Don't: Fetch in multiple places
```typescript
// Component A
useEffect(() => fetchCompanies(), []);

// Component B
useEffect(() => fetchCompanies(), []);
```

### ✅ Do: Use shared React Query cache
```typescript
// Component A
const { data } = useQuery(['companies'], fetchCompanies);

// Component B - uses cached data!
const { data } = useQuery(['companies'], fetchCompanies);
```

---

### ❌ Don't: Manually track loading
```typescript
const [loading, setLoading] = useState(false);
// ... manual loading state management
```

### ✅ Do: Use built-in states
```typescript
const { isLoading, isFetching, isRefetching } = useQuery(...);
```

---

### ❌ Don't: Forget to invalidate
```typescript
const handleDelete = async (id) => {
  await api.delete(id);
  // Data not refetched! UI shows stale data
};
```

### ✅ Do: Invalidate queries
```typescript
const handleDelete = async (id) => {
  await api.delete(id);
  queryClient.invalidateQueries({ queryKey: ['items'] });  // Refetch!
};
```

---

## 📚 Resources

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Query Keys Guide](https://tanstack.com/query/latest/docs/react/guides/query-keys)
- [Mutations Guide](https://tanstack.com/query/latest/docs/react/guides/mutations)

---

## 🎯 Next Components to Convert

Priority list for React Query migration:

1. ✅ **CompanyListHome** - DONE
2. 🔄 **JournalEntriesNew** - Partially done (use full React Query)
3. **BankReconciliation** - Heavy API usage
4. **APReconciliation** - Heavy API usage
5. **MonthEndClose** - Multiple dependent queries
6. **ChartOfAccountsManager** - Large data sets

Each conversion will:
- Eliminate ~50 lines of boilerplate
- Add automatic caching
- Improve perceived performance
- Reduce API costs