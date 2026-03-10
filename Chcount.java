import java.util.*;
class Chcount
{
	public static void main(String args[])
	{
	   int i,j,x,n,sum=0;
	   int a[]=new int[20];
	   int k=0,p=1;
	   Scanner s=new Scanner(System.in);
	System.out.println("enter the no.of numbers");
	   n=s.nextInt();
	System.out.println("enter the numbers");
	   for(i=0;i<n;i++)
		a[i]=s.nextInt();
	   for(i=0;i<n;i++)
	   {
		k=a[i];
		i=i+k-1;
		sum=sum+k;
	   }
	   if(n!=sum)
	   {
		System.out.println("error");
		System.exit(0);
	   }
	   for(i=0;i<n;i++)
	   {
		k=a[i];
		System.out.println("frame:"+p);
		for(j=i;j<k+i;j++)
			System.out.println(a[j]);
		i=i+k-1;
		p++;
	   }
	}
}


