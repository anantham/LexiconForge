import { SuttaStudioView } from './components/sutta-studio';
import { DEMO_PACKET_MN10 } from './components/sutta-studio/demoPacket';

export default function InterfaceIdeaPreview() {
  return <SuttaStudioView packet={DEMO_PACKET_MN10} />;
}
