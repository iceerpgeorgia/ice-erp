import React, { useState, useRef, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { Identifier, XYCoord } from 'dnd-core';
import { GripVertical } from 'lucide-react';
import { ColumnFilter } from './ColumnFilter';
import { ReportData, ColumnConfig } from '../data/reportData';

interface DraggableColumnHeaderProps {
  columnKey: string;
  label: string;
  width: number;
  index: number;
  column: ColumnConfig;
  data: ReportData[];
  activeFilters: Set<any>;
  onResize: (columnKey: string, width: number) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onFilterChange: (columnKey: string, values: Set<any>) => void;
}

interface DragItem {
  type: string;
  index: number;
  columnKey: string;
}

const COLUMN_TYPE = 'COLUMN';

export function DraggableColumnHeader({
  columnKey,
  label,
  width,
  index,
  column,
  data,
  activeFilters,
  onResize,
  onMove,
  onFilterChange,
}: DraggableColumnHeaderProps) {
  const [isResizing, setIsResizing] = useState(false);
  const headerRef = useRef<HTMLTableCellElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const [{ handlerId }, drop] = useDrop<DragItem, void, { handlerId: Identifier | null }>({
    accept: COLUMN_TYPE,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem, monitor) {
      if (!headerRef.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = headerRef.current?.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientX = (clientOffset as XYCoord).x - hoverBoundingRect.left;

      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
        return;
      }

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: COLUMN_TYPE,
    item: () => {
      return { columnKey, index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => !isResizing,
  });

  drag(drop(headerRef));

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(50, startWidthRef.current + diff);
      onResize(columnKey, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, columnKey, onResize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <th
      ref={headerRef}
      data-handler-id={handlerId}
      className={`border border-gray-300 px-3 py-2 text-left whitespace-nowrap bg-gray-100 relative group ${
        isDragging ? 'opacity-50' : 'opacity-100'
      } ${!isResizing ? 'cursor-move' : ''}`}
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
      }}
    >
      <div className="flex items-center justify-between pr-2 gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate select-none">{label}</span>
        </div>
        <ColumnFilter
          column={column}
          data={data}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
        />
      </div>
      <div
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 ${
          isResizing ? 'bg-blue-500' : 'hover:bg-blue-400'
        }`}
        onMouseDown={handleMouseDown}
        style={{
          cursor: 'col-resize',
        }}
      >
        <div
          className={`absolute right-0 top-0 bottom-0 w-[3px] -ml-[1px] ${
            isResizing ? 'bg-blue-500' : ''
          }`}
        />
      </div>
    </th>
  );
}