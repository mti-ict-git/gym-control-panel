import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mock Vault data - in production, this would call external Vault API
const mockVaultUsers = [
  { employee_id: 'EMP001', name: 'Ahmad Rahman', department: 'Engineering', status: 'ACTIVE' },
  { employee_id: 'EMP002', name: 'Sarah Lee', department: 'Marketing', status: 'ACTIVE' },
  { employee_id: 'EMP003', name: 'Budi Santoso', department: 'Finance', status: 'ACTIVE' },
  { employee_id: 'EMP004', name: 'Maya Chen', department: 'HR', status: 'INACTIVE' },
  { employee_id: 'EMP005', name: 'Ravi Kumar', department: 'Engineering', status: 'ACTIVE' },
  { employee_id: 'EMP006', name: 'Lisa Wong', department: 'Operations', status: 'ACTIVE' },
  { employee_id: 'EMP007', name: 'John Smith', department: 'Sales', status: 'INACTIVE' },
  { employee_id: 'EMP008', name: 'Dewi Putri', department: 'Engineering', status: 'ACTIVE' },
  { employee_id: 'EMP009', name: 'Michael Tan', department: 'Finance', status: 'ACTIVE' },
  { employee_id: 'EMP010', name: 'Anita Sari', department: 'Marketing', status: 'ACTIVE' },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching vault users...');
    
    // In production, you would fetch from actual Vault API:
    // const vaultApiUrl = Deno.env.get('VAULT_API_URL');
    // const response = await fetch(`${vaultApiUrl}/users`, { headers: { ... } });
    // const data = await response.json();
    
    // For now, return mock data
    return new Response(JSON.stringify({ users: mockVaultUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching vault users:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
