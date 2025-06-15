
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Order = Tables<'orders'>;
type Product = Tables<'products'>;

interface OrderDetailsCardProps {
    order: Order;
    product: Product;
}

const OrderDetailsCard = ({ order, product }: OrderDetailsCardProps) => (
    <Card>
        <CardHeader>
            <CardTitle>Packing: Order #{order.order_number}</CardTitle>
        </CardHeader>
        <CardContent>
            <p><strong>Product:</strong> {product.name}</p>
            <p><strong>Price:</strong> ${product.price}</p>
        </CardContent>
    </Card>
);

export default OrderDetailsCard;
