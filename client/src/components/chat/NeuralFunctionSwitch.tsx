import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { 
  ChevronDownIcon, 
  MapIcon, 
  Square3Stack3DIcon, 
  CommandLineIcon,
  CircleStackIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

interface NeuralFunctionSwitchProps {
  isCanvasOpen: boolean;
  setIsCanvasOpen: (open: boolean) => void;
  artifactCount: number;
}

const NeuralFunctionSwitch: React.FC<NeuralFunctionSwitchProps> = ({
  isCanvasOpen,
  setIsCanvasOpen,
  artifactCount
}) => {
  const navigate = useNavigate();

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="group flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/40 hover:bg-white/60 backdrop-blur-md border border-black/[0.05] hover:border-black/[0.1] transition-all duration-300 shadow-sm active:scale-95">
          <div className="relative">
             <CircleStackIcon className="w-4 h-4 text-[#4A4D5E] group-hover:text-[#fd3b12] transition-colors" />
             {artifactCount > 0 && (
               <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#fd3b12] rounded-full animate-pulse border border-white" />
             )}
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#1A1D2E]">System Functions</span>
          <ChevronDownIcon className="w-3.5 h-3.5 text-[#7A7D8E] group-hover:text-[#1A1D2E] transition-colors" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95 translate-y-[-10px]"
        enterTo="transform opacity-100 scale-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="transform opacity-100 scale-100 translate-y-0"
        leaveTo="transform opacity-0 scale-95 translate-y-[-10px]"
      >
        <Menu.Items className="absolute right-0 mt-2 w-64 origin-top-right divide-y divide-black/[0.05] rounded-3xl bg-white/80 backdrop-blur-2xl border border-white/40 shadow-2xl focus:outline-none z-50 overflow-hidden">
          <div className="px-2 py-2">
            <Menu.Item>
              {({ active }) => (
                <a
                  href="http://127.0.0.1:11434"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${
                    active ? 'bg-[#fd3b12]/10 text-[#fd3b12]' : 'text-[#4A4D5E]'
                  } group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-xs font-bold transition-all`}
                >
                  <CommandLineIcon className={`h-5 w-5 ${active ? 'text-[#fd3b12]' : 'text-[#7A7D8E]'}`} />
                  <div className="flex flex-col">
                    <span>Llama Engine Portal</span>
                    <span className="text-[9px] opacity-60 font-medium">Local llama.cpp Control Node</span>
                  </div>
                </a>
              )}
            </Menu.Item>
            
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => navigate('/admin/overview')}
                  className={`${
                    active ? 'bg-[#fd3b12]/10 text-[#fd3b12]' : 'text-[#4A4D5E]'
                  } group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-xs font-bold transition-all`}
                >
                  <MapIcon className={`h-5 w-5 ${active ? 'text-[#fd3b12]' : 'text-[#7A7D8E]'}`} />
                  <div className="flex flex-col text-left">
                    <span>Global Knowledge Map</span>
                    <span className="text-[9px] opacity-60 font-medium">Super-Admin Intelligence Layer</span>
                  </div>
                </button>
              )}
            </Menu.Item>
          </div>

          <div className="px-2 py-2">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => setIsCanvasOpen(!isCanvasOpen)}
                  className={`${
                    isCanvasOpen ? 'bg-[#fd3b12]/5 text-[#fd3b12]' : 
                    active ? 'bg-black/5 text-[#1A1D2E]' : 'text-[#4A4D5E]'
                  } group flex w-full items-center justify-between rounded-2xl px-3 py-3 text-xs font-bold transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <Square3Stack3DIcon className={`h-5 w-5 ${isCanvasOpen ? 'text-[#fd3b12]' : 'text-[#7A7D8E]'}`} />
                    <div className="flex flex-col text-left">
                      <span>Agent Canvas</span>
                      <span className="text-[9px] opacity-60 font-medium">Toggle Multi-Modular Workbench</span>
                    </div>
                  </div>
                  {artifactCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#fd3b12] text-white text-[9px] font-black">
                      {artifactCount}
                    </span>
                  )}
                </button>
              )}
            </Menu.Item>
          </div>
          
          <div className="bg-black/[0.02] px-4 py-3">
             <p className="text-[8px] font-bold uppercase tracking-widest text-[#7A7D8E] leading-tight">
               AICodex System Shifter v1.0 <br/>
               <span className="opacity-40">Neural•Core Operational Status: Stable</span>
             </p>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default NeuralFunctionSwitch;
