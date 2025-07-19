
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Order = Tables<'orders'>;
type Product = Tables<'products'>;

interface OrderDetailsCardProps {
    order: Order;
    product: Product;
}

const OrderDetailsCard = ({ order, product }: OrderDetailsCardProps) => (
    <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="bg-white">
            <CardTitle className="text-slate-900">Packing: Order #{order.order_number}</CardTitle>
        </CardHeader>
        <CardContent className="bg-white">
        </CardContent>
    </Card>
);

export default OrderDetailsCard;
