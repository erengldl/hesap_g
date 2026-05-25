import { NextResponse } from 'next/server';
import { requireAuth } from "@/lib/api-auth";

type CategoryRow = {
  category_id: number;
  parent_id: number | null;
  name: string;
  level: number;
  path: string | null;
};

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const { getMarketplaceCategories } = require('@/lib/database-readers');
    const rawCategories = getMarketplaceCategories() as CategoryRow[];
    
    if (!rawCategories || rawCategories.length === 0) {
      return NextResponse.json({ success: true, categories: [], source: 'empty' });
    }

    // Build tree from parent_id hierarchy
    const nodeMap = new Map<number, any>();
    const tree: any[] = [];

    // First pass: create all nodes
    for (const row of rawCategories) {
      nodeMap.set(row.category_id, {
        id: String(row.category_id),
        name: row.name,
        children: [],
        _parentId: row.parent_id,
        _level: row.level,
        _path: row.path,
      });
    }

    // Second pass: link parents to children
    for (const row of rawCategories) {
      const node = nodeMap.get(row.category_id)!;
      if (row.parent_id === null || row.parent_id === 0) {
        // Root node
        tree.push(node);
      } else {
        const parent = nodeMap.get(row.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          // Orphan Ã¢â‚¬â€ treat as root
          tree.push(node);
        }
      }
    }

    // Clean up internal fields and sort
    function processNode(node: any): any {
      delete node._parentId;
      delete node._level;
      delete node._path;

      if (node.children && node.children.length > 0) {
        node.children.sort((a: any, b: any) => a.name.localeCompare(b.name, 'tr'));
        node.children.forEach(processNode);
      } else {
        delete node.children;
      }
      return node;
    }

    const finalTree = tree
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .map(processNode);

    return NextResponse.json({ 
      success: true, 
      categories: finalTree, 
      source: 'database',
      totalCount: rawCategories.length 
    });
  } catch (error) {
    console.error('Category API error:', error);
    return NextResponse.json({ success: false, error: 'Kategoriler yÃƒÂ¼klenemedi.', categories: [] });
  }
}
