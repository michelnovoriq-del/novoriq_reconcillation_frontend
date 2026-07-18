"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorAlert } from "@/components/ui/alert";

export default function ClientWorkspacesPage() {
  const queryClient=useQueryClient(); const [name,setName]=useState(""); const [description,setDescription]=useState(""); const [error,setError]=useState("");
  const workspaces=useQuery({queryKey:["workspaces"],queryFn:api.listWorkspaces});
  const create=useMutation({mutationFn:()=>api.createWorkspace({name,description}),onSuccess:async()=>{setName("");setDescription("");await queryClient.invalidateQueries({queryKey:["workspaces"]});}});
  async function submit(){setError("");if(!name.trim()){setError("Enter a client workspace name.");return;}try{await create.mutateAsync();}catch(err){setError(err instanceof Error?err.message:"Could not create client workspace.");}}
  return <div className="space-y-6"><div><p className="text-sm font-black uppercase tracking-[0.18em] text-deepblue">Clients</p><h1 className="text-3xl font-black text-ink">Client workspaces</h1><p className="mt-2 text-sm text-slate-600">Keep each client’s files and reconciliation runs separate.</p></div><Card><CardHeader><CardTitle>Create client workspace</CardTitle></CardHeader><CardContent className="space-y-3"><ErrorAlert message={error}/><Input placeholder="Demo Ecommerce Client" value={name} onChange={(event)=>setName(event.target.value)}/><Input placeholder="Optional description" value={description} onChange={(event)=>setDescription(event.target.value)}/><Button variant="sky" onClick={submit} disabled={create.isPending}>Create workspace</Button></CardContent></Card><div className="grid gap-4 md:grid-cols-2">{workspaces.data?.map((workspace)=><Card key={workspace.id} className="p-5"><div className="flex items-center justify-between"><div><p className="font-black text-ink">{workspace.name}</p><p className="text-sm text-slate-500">{workspace.description||"No description"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{workspace.status}</span></div></Card>)}</div></div>;
}
